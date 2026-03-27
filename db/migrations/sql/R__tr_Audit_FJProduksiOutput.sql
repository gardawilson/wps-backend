/* ===== [dbo].[tr_Audit_FJProduksiOutput] ON [dbo].[FJProduksiOutput] ===== */
CREATE OR ALTER TRIGGER [dbo].[tr_Audit_FJProduksiOutput]
ON [dbo].[FJProduksiOutput]
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
       PK yang dipakai: NoProduksi + NoFJ
       - single: {"NoProduksi":"...","NoFJ":"..."}
       - multi : {"PKList":[{"NoProduksi":"...","NoFJ":"..."}, ...]}
    ========================================================= */
    DECLARE @pkMax int = COALESCE(NULLIF(COL_LENGTH('dbo.AuditTrail','PK') / 2, 0), 800);
    DECLARE @pk nvarchar(max);

    ;WITH x AS (
      SELECT NoProduksi, NoFJ FROM inserted
      UNION
      SELECT NoProduksi, NoFJ FROM deleted
    )
    SELECT
      @pk =
        CASE
          WHEN COUNT(1) = 1
            THEN CONCAT(
              '{"NoProduksi":"', MAX(NoProduksi),
              '","NoFJ":"', MAX(NoFJ),
              '"}'
            )
          ELSE
            CONCAT(
              '{"PKList":',
              (SELECT NoProduksi, NoFJ FROM x ORDER BY NoProduksi, NoFJ FOR JSON PATH),
              '}'
            )
        END
    FROM x;

    IF @pk IS NOT NULL AND LEN(@pk) > @pkMax
    BEGIN
      ;WITH x AS (
        SELECT NoProduksi, NoFJ FROM inserted
        UNION
        SELECT NoProduksi, NoFJ FROM deleted
      )
      SELECT
        @pk = CONCAT(
          '{"PKListSummary":{"Count":', COUNT(1),
          ',"FirstNoProduksi":"', MIN(NoProduksi),
          '","LastNoProduksi":"', MAX(NoProduksi), '"}}'
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
        'FJProduksiOutput',
        @actor,
        @rid,
        @pk,
        NULL,
        (
          SELECT
            i.NoProduksi,
            i.NoFJ
          FROM inserted i
          ORDER BY i.NoProduksi, i.NoFJ
          FOR JSON PATH
        );
    END

    /* DELETE */
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'DELETE',
        'FJProduksiOutput',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoProduksi,
            d.NoFJ
          FROM deleted d
          ORDER BY d.NoProduksi, d.NoFJ
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
        'FJProduksiOutput',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoProduksi,
            d.NoFJ
          FROM deleted d
          ORDER BY d.NoProduksi, d.NoFJ
          FOR JSON PATH
        ),
        (
          SELECT
            i.NoProduksi,
            i.NoFJ
          FROM inserted i
          ORDER BY i.NoProduksi, i.NoFJ
          FOR JSON PATH
        );
    END
  END TRY
  BEGIN CATCH
    PRINT CONCAT('[AUDIT_WARN][tr_Audit_FJProduksiOutput] ', ERROR_MESSAGE());
  END CATCH
END;
GO
