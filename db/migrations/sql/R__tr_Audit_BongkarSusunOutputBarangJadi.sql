/* ===== [dbo].[tr_Audit_BongkarSusunOutputBarangJadi] ON [dbo].[BongkarSusunOutputBarangJadi] ===== */
CREATE OR ALTER TRIGGER [dbo].[tr_Audit_BongkarSusunOutputBarangJadi]
ON [dbo].[BongkarSusunOutputBarangJadi]
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
       PK yang dipakai: NoBongkarSusun + NoBJ
       - single: {"NoBongkarSusun":"...","NoBJ":"..."}
       - multi : {"PKList":[{"NoBongkarSusun":"...","NoBJ":"..."}, ...]}
    ========================================================= */
    DECLARE @pkMax int = COALESCE(NULLIF(COL_LENGTH('dbo.AuditTrail','PK') / 2, 0), 800);
    DECLARE @pk nvarchar(max);

    ;WITH x AS (
      SELECT NoBongkarSusun, NoBJ FROM inserted
      UNION
      SELECT NoBongkarSusun, NoBJ FROM deleted
    )
    SELECT
      @pk =
        CASE
          WHEN COUNT(1) = 1
            THEN CONCAT(
              '{"NoBongkarSusun":"', MAX(NoBongkarSusun),
              '","NoBJ":"', MAX(NoBJ),
              '"}'
            )
          ELSE
            CONCAT(
              '{"PKList":',
              (SELECT NoBongkarSusun, NoBJ FROM x ORDER BY NoBongkarSusun, NoBJ FOR JSON PATH),
              '}'
            )
        END
    FROM x;

    IF @pk IS NOT NULL AND LEN(@pk) > @pkMax
    BEGIN
      ;WITH x AS (
        SELECT NoBongkarSusun, NoBJ FROM inserted
        UNION
        SELECT NoBongkarSusun, NoBJ FROM deleted
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
        'BongkarSusunOutputBarangJadi',
        @actor,
        @rid,
        @pk,
        NULL,
        (
          SELECT
            i.NoBongkarSusun,
            i.NoBJ
          FROM inserted i
          ORDER BY i.NoBongkarSusun, i.NoBJ
          FOR JSON PATH
        );
    END

    /* DELETE */
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'DELETE',
        'BongkarSusunOutputBarangJadi',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoBongkarSusun,
            d.NoBJ
          FROM deleted d
          ORDER BY d.NoBongkarSusun, d.NoBJ
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
        'BongkarSusunOutputBarangJadi',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoBongkarSusun,
            d.NoBJ
          FROM deleted d
          ORDER BY d.NoBongkarSusun, d.NoBJ
          FOR JSON PATH
        ),
        (
          SELECT
            i.NoBongkarSusun,
            i.NoBJ
          FROM inserted i
          ORDER BY i.NoBongkarSusun, i.NoBJ
          FOR JSON PATH
        );
    END
  END TRY
  BEGIN CATCH
    PRINT CONCAT('[AUDIT_WARN][tr_Audit_BongkarSusunOutputBarangJadi] ', ERROR_MESSAGE());
  END CATCH
END;
GO
