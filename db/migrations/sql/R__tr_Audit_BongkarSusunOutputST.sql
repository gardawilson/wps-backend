/* ===== [dbo].[tr_Audit_BongkarSusunOutputST] ON [dbo].[BongkarSusunOutputST] ===== */
CREATE OR ALTER TRIGGER [dbo].[tr_Audit_BongkarSusunOutputST]
ON [dbo].[BongkarSusunOutputST]
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
       PK yang dipakai: NoBongkarSusun + NoST
       - single: {"NoBongkarSusun":"...","NoST":"..."}
       - multi : {"PKList":[{"NoBongkarSusun":"...","NoST":"..."}, ...]}
    ========================================================= */
    DECLARE @pkMax int = COALESCE(NULLIF(COL_LENGTH('dbo.AuditTrail','PK') / 2, 0), 800);
    DECLARE @pk nvarchar(max);

    ;WITH x AS (
      SELECT NoBongkarSusun, NoST FROM inserted
      UNION
      SELECT NoBongkarSusun, NoST FROM deleted
    )
    SELECT
      @pk =
        CASE
          WHEN COUNT(1) = 1
            THEN CONCAT(
              '{"NoBongkarSusun":"', MAX(NoBongkarSusun),
              '","NoST":"', MAX(NoST),
              '"}'
            )
          ELSE
            CONCAT(
              '{"PKList":',
              (SELECT NoBongkarSusun, NoST FROM x ORDER BY NoBongkarSusun, NoST FOR JSON PATH),
              '}'
            )
        END
    FROM x;

    IF @pk IS NOT NULL AND LEN(@pk) > @pkMax
    BEGIN
      ;WITH x AS (
        SELECT NoBongkarSusun, NoST FROM inserted
        UNION
        SELECT NoBongkarSusun, NoST FROM deleted
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
        'PRODUCE',
        'BongkarSusunOutputST',
        @actor,
        @rid,
        @pk,
        NULL,
        (
          SELECT
            i.NoBongkarSusun,
            i.NoST
          FROM inserted i
          ORDER BY i.NoBongkarSusun, i.NoST
          FOR JSON PATH
        );
    END

    /* DELETE */
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'UNPRODUCE',
        'BongkarSusunOutputST',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoBongkarSusun,
            d.NoST
          FROM deleted d
          ORDER BY d.NoBongkarSusun, d.NoST
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
        'BongkarSusunOutputST',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoBongkarSusun,
            d.NoST
          FROM deleted d
          ORDER BY d.NoBongkarSusun, d.NoST
          FOR JSON PATH
        ),
        (
          SELECT
            i.NoBongkarSusun,
            i.NoST
          FROM inserted i
          ORDER BY i.NoBongkarSusun, i.NoST
          FOR JSON PATH
        );
    END
  END TRY
  BEGIN CATCH
    PRINT CONCAT('[AUDIT_WARN][tr_Audit_BongkarSusunOutputST] ', ERROR_MESSAGE());
  END CATCH
END;
GO
