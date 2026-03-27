/* ===== [dbo].[tr_Audit_BongkarSusunOutputS4S] ON [dbo].[BongkarSusunOutputS4S] ===== */
CREATE OR ALTER TRIGGER [dbo].[tr_Audit_BongkarSusunOutputS4S]
ON [dbo].[BongkarSusunOutputS4S]
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    DECLARE @actor nvarchar(128) =
      COALESCE(
        CONVERT(nvarchar(128), TRY_CONVERT(int, SESSION_CONTEXT(N'actor_id'))),
        CAST(SESSION_CONTEXT(N'actor') AS nvarchar(128)),
        SUSER_SNAME()
      );

    DECLARE @rid nvarchar(64) =
      CAST(SESSION_CONTEXT(N'request_id') AS nvarchar(64));

    /* =========================================================
       Helper: bentuk PK ringkas (single / list)
       PK yang dipakai: NoBongkarSusun + NoS4S
       - single: {"NoBongkarSusun":"...","NoS4S":"..."}
       - multi : {"PKList":[{"NoBongkarSusun":"...","NoS4S":"..."}, ...]}
    ========================================================= */
    DECLARE @pkMax int = COALESCE(NULLIF(COL_LENGTH('dbo.AuditTrail','PK') / 2, 0), 800);
    DECLARE @pk nvarchar(max);

    ;WITH x AS (
      SELECT NoBongkarSusun, NoS4S FROM inserted
      UNION
      SELECT NoBongkarSusun, NoS4S FROM deleted
    )
    SELECT
      @pk =
        CASE
          WHEN COUNT(1) = 1
            THEN CONCAT(
              '{"NoBongkarSusun":"', MAX(NoBongkarSusun),
              '","NoS4S":"', MAX(NoS4S),
              '"}'
            )
          ELSE
            CONCAT(
              '{"PKList":',
              (SELECT NoBongkarSusun, NoS4S FROM x ORDER BY NoBongkarSusun, NoS4S FOR JSON PATH),
              '}'
            )
        END
    FROM x;

    IF @pk IS NOT NULL AND LEN(@pk) > @pkMax
    BEGIN
      ;WITH x AS (
        SELECT NoBongkarSusun, NoS4S FROM inserted
        UNION
        SELECT NoBongkarSusun, NoS4S FROM deleted
      )
      SELECT
        @pk = CONCAT(
          '{"PKListSummary":{"Count":', COUNT(1),
          ',"FirstNoBongkarSusun":"', MIN(NoBongkarSusun),
          '","LastNoBongkarSusun":"', MAX(NoBongkarSusun), '"}}'
        )
      FROM x;
    END;

    SET @pk = LEFT(@pk, @pkMax);
    SET @actor = LEFT(@actor, 128);
    SET @rid = LEFT(@rid, 64);

    /* INSERT */
    IF EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'INSERT',
        'BongkarSusunOutputS4S',
        @actor,
        @rid,
        @pk,
        NULL,
        (
          SELECT
            i.NoBongkarSusun,
            i.NoS4S
          FROM inserted i
          ORDER BY i.NoBongkarSusun, i.NoS4S
          FOR JSON PATH
        );
    END

    /* DELETE */
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'DELETE',
        'BongkarSusunOutputS4S',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoBongkarSusun,
            d.NoS4S
          FROM deleted d
          ORDER BY d.NoBongkarSusun, d.NoS4S
          FOR JSON PATH
        ),
        NULL;
    END

    /* UPDATE */
    IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'UPDATE',
        'BongkarSusunOutputS4S',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoBongkarSusun,
            d.NoS4S
          FROM deleted d
          ORDER BY d.NoBongkarSusun, d.NoS4S
          FOR JSON PATH
        ),
        (
          SELECT
            i.NoBongkarSusun,
            i.NoS4S
          FROM inserted i
          ORDER BY i.NoBongkarSusun, i.NoS4S
          FOR JSON PATH
        );
    END
  END TRY
  BEGIN CATCH
    PRINT CONCAT('[AUDIT_WARN][tr_Audit_BongkarSusunOutputS4S] ', ERROR_MESSAGE());
  END CATCH
END;
GO
