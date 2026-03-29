/* ===== [dbo].[tr_Audit_BarangJadi_h] ON [dbo].[BarangJadi_h] ===== */
CREATE OR ALTER TRIGGER [dbo].[tr_Audit_BarangJadi_h]
ON [dbo].[BarangJadi_h]
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
       PK yang dipakai: NoBJ
       - single: {"NoBJ":"..."}
       - multi : {"PKList":[{"NoBJ":"..."}, ...]}
    ========================================================= */
    DECLARE @pkMax int = COALESCE(NULLIF(COL_LENGTH('dbo.AuditTrail','PK') / 2, 0), 800);
    DECLARE @pk nvarchar(max);

    ;WITH x AS (
      SELECT NoBJ FROM inserted
      UNION
      SELECT NoBJ FROM deleted
    )
    SELECT
      @pk =
        CASE
          WHEN COUNT(1) = 1
            THEN CONCAT('{"NoBJ":"', MAX(NoBJ), '"}')
          ELSE
            CONCAT(
              '{"PKList":',
              (SELECT NoBJ FROM x ORDER BY NoBJ FOR JSON PATH),
              '}'
            )
        END
    FROM x;

    IF @pk IS NOT NULL AND LEN(@pk) > @pkMax
    BEGIN
      ;WITH x AS (
        SELECT NoBJ FROM inserted
        UNION
        SELECT NoBJ FROM deleted
      )
      SELECT
        @pk = CONCAT(
          '{"PKListSummary":{"Count":', COUNT(1),
          ',"First":"', MIN(NoBJ),
          '","Last":"', MAX(NoBJ), '"}}'
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
        'BarangJadi_h',
        @actor,
        @rid,
        @pk,
        NULL,
        (
          SELECT
            i.NoBJ,
            i.IdJenisKayu,
            i.IdBarangJadi,
            i.DateCreate,
            i.DateUsage,
            i.IdOrgTelly,
            i.IdFJProfile,
            i.NoSPK,
            i.Jam,
            i.IsReject,
            i.IsSisa,
            i.NoWIPAsal,
            i.NoMouldingAsal,
            i.NoSandingAsal,
            i.IdWarehouse,
            i.IsLembur,
            i.IdLokasi,
            i.HasBeenPrinted,
            i.NoSPKAsal,
            i.Remark,
            i.LastPrintDate,
            i.NoSPKTujuan
          FROM inserted i
          ORDER BY i.NoBJ
          FOR JSON PATH
        );
    END

    /* DELETE */
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'DELETE',
        'BarangJadi_h',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoBJ,
            d.IdJenisKayu,
            d.IdBarangJadi,
            d.DateCreate,
            d.DateUsage,
            d.IdOrgTelly,
            d.IdFJProfile,
            d.NoSPK,
            d.Jam,
            d.IsReject,
            d.IsSisa,
            d.NoWIPAsal,
            d.NoMouldingAsal,
            d.NoSandingAsal,
            d.IdWarehouse,
            d.IsLembur,
            d.IdLokasi,
            d.HasBeenPrinted,
            d.NoSPKAsal,
            d.Remark,
            d.LastPrintDate,
            d.NoSPKTujuan
          FROM deleted d
          ORDER BY d.NoBJ
          FOR JSON PATH
        ),
        NULL;
    END

    /* UPDATE */
    IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted)
    BEGIN
      DECLARE @action varchar(50) = 'UPDATE';

      IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN deleted d ON i.NoBJ = d.NoBJ
        WHERE ISNULL(i.HasBeenPrinted, 0) <> ISNULL(d.HasBeenPrinted, 0)
      )
      BEGIN
        SET @action = 'PRINT';
      END

      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        @action,
        'BarangJadi_h',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoBJ,
            d.IdJenisKayu,
            d.IdBarangJadi,
            d.DateCreate,
            d.DateUsage,
            d.IdOrgTelly,
            d.IdFJProfile,
            d.NoSPK,
            d.Jam,
            d.IsReject,
            d.IsSisa,
            d.NoWIPAsal,
            d.NoMouldingAsal,
            d.NoSandingAsal,
            d.IdWarehouse,
            d.IsLembur,
            d.IdLokasi,
            d.HasBeenPrinted,
            d.NoSPKAsal,
            d.Remark,
            d.LastPrintDate,
            d.NoSPKTujuan
          FROM deleted d
          ORDER BY d.NoBJ
          FOR JSON PATH
        ),
        (
          SELECT
            i.NoBJ,
            i.IdJenisKayu,
            i.IdBarangJadi,
            i.DateCreate,
            i.DateUsage,
            i.IdOrgTelly,
            i.IdFJProfile,
            i.NoSPK,
            i.Jam,
            i.IsReject,
            i.IsSisa,
            i.NoWIPAsal,
            i.NoMouldingAsal,
            i.NoSandingAsal,
            i.IdWarehouse,
            i.IsLembur,
            i.IdLokasi,
            i.HasBeenPrinted,
            i.NoSPKAsal,
            i.Remark,
            i.LastPrintDate,
            i.NoSPKTujuan
          FROM inserted i
          ORDER BY i.NoBJ
          FOR JSON PATH
        );
    END
  END TRY
  BEGIN CATCH
    PRINT CONCAT('[AUDIT_WARN][tr_Audit_BarangJadi_h] ', ERROR_MESSAGE());
  END CATCH
END;
GO
