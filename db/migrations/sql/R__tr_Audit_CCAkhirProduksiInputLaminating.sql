/* ===== [dbo].[tr_Audit_CCAkhirProduksiInputLaminating] ON [dbo].[CCAkhirProduksiInputLaminating] ===== */
CREATE OR ALTER TRIGGER [dbo].[tr_Audit_CCAkhirProduksiInputLaminating]
ON [dbo].[CCAkhirProduksiInputLaminating]
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
       PK yang dipakai: NoProduksi + NoLaminating (composite)
       Format: {"NoProduksi":"...","NoLaminating":"..."}
    ========================================================= */
    DECLARE @pkMax int = COALESCE(NULLIF(COL_LENGTH('dbo.AuditTrail','PK') / 2, 0), 800);
    DECLARE @pk nvarchar(max);

    ;WITH x AS (
      SELECT NoProduksi, NoLaminating FROM inserted
      UNION
      SELECT NoProduksi, NoLaminating FROM deleted
    )
    SELECT TOP 1
      @pk = CONCAT('{"NoProduksi":"', NoProduksi, '","NoLaminating":"', NoLaminating, '"}')
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
        'CCAkhirProduksiInputLaminating',
        @actor,
        @rid,
        @pk,
        NULL,
        (
          SELECT
            i.NoProduksi,
            i.NoLaminating,
            i.DateTimeSaved
          FROM inserted i
          ORDER BY i.NoProduksi, i.NoLaminating
          FOR JSON PATH
        );
    END

    /* UNCONSUME */
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'UNCONSUME',
        'CCAkhirProduksiInputLaminating',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoProduksi,
            d.NoLaminating,
            d.DateTimeSaved
          FROM deleted d
          ORDER BY d.NoProduksi, d.NoLaminating
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
        'CCAkhirProduksiInputLaminating',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoProduksi,
            d.NoLaminating,
            d.DateTimeSaved
          FROM deleted d
          ORDER BY d.NoProduksi, d.NoLaminating
          FOR JSON PATH
        ),
        (
          SELECT
            i.NoProduksi,
            i.NoLaminating,
            i.DateTimeSaved
          FROM inserted i
          ORDER BY i.NoProduksi, i.NoLaminating
          FOR JSON PATH
        );
    END
  END TRY
  BEGIN CATCH
    PRINT CONCAT('[AUDIT_WARN][tr_Audit_CCAkhirProduksiInputLaminating] ', ERROR_MESSAGE());
  END CATCH
END;
GO
