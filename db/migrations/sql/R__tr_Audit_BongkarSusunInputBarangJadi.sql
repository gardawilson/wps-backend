/* ===== [dbo].[tr_Audit_BongkarSusunInputBarangJadi] ON [dbo].[BongkarSusunInputBarangJadi] ===== */
CREATE OR ALTER TRIGGER [dbo].[tr_Audit_BongkarSusunInputBarangJadi]
ON [dbo].[BongkarSusunInputBarangJadi]
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
       PK yang dipakai: NoBongkarSusun + NoBJ (composite)
       Format: {"NoBongkarSusun":"...","NoBJ":"..."}
    ========================================================= */
    DECLARE @pkMax int = COALESCE(NULLIF(COL_LENGTH('dbo.AuditTrail','PK') / 2, 0), 800);
    DECLARE @pk nvarchar(max);

    ;WITH x AS (
      SELECT NoBongkarSusun, NoBJ FROM inserted
      UNION
      SELECT NoBongkarSusun, NoBJ FROM deleted
    )
    SELECT TOP 1
      @pk = CONCAT('{"NoBongkarSusun":"', NoBongkarSusun, '","NoBJ":"', NoBJ, '"}')
    FROM x;

    SET @pk = LEFT(@pk, @pkMax);
    SET @actor = LEFT(@actor, 128);
    SET @rid = LEFT(@rid, 64);

    /* CONSUME */
    IF EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'CONSUME',
        'BongkarSusunInputBarangJadi',
        @actor,
        @rid,
        @pk,
        NULL,
        (
          SELECT
            i.NoBongkarSusun,
            i.NoBJ,
            i.DateTimeSaved
          FROM inserted i
          ORDER BY i.NoBongkarSusun, i.NoBJ
          FOR JSON PATH
        );
    END

    /* UNCONSUME */
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'UNCONSUME',
        'BongkarSusunInputBarangJadi',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoBongkarSusun,
            d.NoBJ,
            d.DateTimeSaved
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
        'BongkarSusunInputBarangJadi',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoBongkarSusun,
            d.NoBJ,
            d.DateTimeSaved
          FROM deleted d
          ORDER BY d.NoBongkarSusun, d.NoBJ
          FOR JSON PATH
        ),
        (
          SELECT
            i.NoBongkarSusun,
            i.NoBJ,
            i.DateTimeSaved
          FROM inserted i
          ORDER BY i.NoBongkarSusun, i.NoBJ
          FOR JSON PATH
        );
    END
  END TRY
  BEGIN CATCH
    PRINT CONCAT('[AUDIT_WARN][tr_Audit_BongkarSusunInputBarangJadi] ', ERROR_MESSAGE());
  END CATCH
END;
GO
