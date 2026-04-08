/* ===== [dbo].[tr_Audit_BongkarSusunInputS4S] ON [dbo].[BongkarSusunInputS4S] ===== */
CREATE OR ALTER TRIGGER [dbo].[tr_Audit_BongkarSusunInputS4S]
ON [dbo].[BongkarSusunInputS4S]
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
       PK yang dipakai: NoBongkarSusun + NoS4S (composite)
       Format: {"NoBongkarSusun":"...","NoS4S":"..."}
    ========================================================= */
    DECLARE @pkMax int = COALESCE(NULLIF(COL_LENGTH('dbo.AuditTrail','PK') / 2, 0), 800);
    DECLARE @pk nvarchar(max);

    ;WITH x AS (
      SELECT NoBongkarSusun, NoS4S FROM inserted
      UNION
      SELECT NoBongkarSusun, NoS4S FROM deleted
    )
    SELECT TOP 1
      @pk = CONCAT('{"NoBongkarSusun":"', NoBongkarSusun, '","NoS4S":"', NoS4S, '"}')
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
        'BongkarSusunInputS4S',
        @actor,
        @rid,
        @pk,
        NULL,
        (
          SELECT
            i.NoBongkarSusun,
            i.NoS4S,
            i.DateTimeSaved
          FROM inserted i
          ORDER BY i.NoBongkarSusun, i.NoS4S
          FOR JSON PATH
        );
    END

    /* UNCONSUME */
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'UNCONSUME',
        'BongkarSusunInputS4S',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoBongkarSusun,
            d.NoS4S,
            d.DateTimeSaved
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
        'BongkarSusunInputS4S',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoBongkarSusun,
            d.NoS4S,
            d.DateTimeSaved
          FROM deleted d
          ORDER BY d.NoBongkarSusun, d.NoS4S
          FOR JSON PATH
        ),
        (
          SELECT
            i.NoBongkarSusun,
            i.NoS4S,
            i.DateTimeSaved
          FROM inserted i
          ORDER BY i.NoBongkarSusun, i.NoS4S
          FOR JSON PATH
        );
    END
  END TRY
  BEGIN CATCH
    PRINT CONCAT('[AUDIT_WARN][tr_Audit_BongkarSusunInputS4S] ', ERROR_MESSAGE());
  END CATCH
END;
GO
