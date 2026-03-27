/* ===== [dbo].[tr_Audit_CCAkhir_h] ON [dbo].[CCAkhir_h] ===== */
CREATE OR ALTER TRIGGER [dbo].[tr_Audit_CCAkhir_h]
ON [dbo].[CCAkhir_h]
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
       PK yang dipakai: NoCCAkhir
       - single: {"NoCCAkhir":"..."}
       - multi : {"PKList":[{"NoCCAkhir":"..."}, ...]}
    ========================================================= */
    DECLARE @pkMax int = COALESCE(NULLIF(COL_LENGTH('dbo.AuditTrail','PK') / 2, 0), 800);
    DECLARE @pk nvarchar(max);

    ;WITH x AS (
      SELECT NoCCAkhir FROM inserted
      UNION
      SELECT NoCCAkhir FROM deleted
    )
    SELECT
      @pk =
        CASE
          WHEN COUNT(1) = 1
            THEN CONCAT('{"NoCCAkhir":"', MAX(NoCCAkhir), '"}')
          ELSE
            CONCAT(
              '{"PKList":',
              (SELECT NoCCAkhir FROM x ORDER BY NoCCAkhir FOR JSON PATH),
              '}'
            )
        END
    FROM x;

    IF @pk IS NOT NULL AND LEN(@pk) > @pkMax
    BEGIN
      ;WITH x AS (
        SELECT NoCCAkhir FROM inserted
        UNION
        SELECT NoCCAkhir FROM deleted
      )
      SELECT
        @pk = CONCAT(
          '{"PKListSummary":{"Count":', COUNT(1),
          ',"First":"', MIN(NoCCAkhir),
          '","Last":"', MAX(NoCCAkhir), '"}}'
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
        'CCAkhir_h',
        @actor,
        @rid,
        @pk,
        NULL,
        (
          SELECT
            i.NoCCAkhir,
            i.IdJenisKayu,
            i.IdGrade,
            i.IdOrgTelly,
            i.DateCreate,
            i.DateUsage,
            i.IdUOMTblLebar,
            i.IdUOMPanjang,
            i.NoSPK,
            i.Jam,
            i.IsReject,
            i.NoLaminatingAsal,
            i.NoFJAsal,
            i.IdWarehouse,
            i.IdFJProfile,
            i.IdLokasi,
            i.IsLembur,
            i.HasBeenPrinted,
            i.IdFisik,
            i.NoSPKAsal,
            i.Remark,
            i.LastPrintDate,
            i.NoSPKTujuan
          FROM inserted i
          ORDER BY i.NoCCAkhir
          FOR JSON PATH
        );
    END

    /* DELETE */
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'DELETE',
        'CCAkhir_h',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoCCAkhir,
            d.IdJenisKayu,
            d.IdGrade,
            d.IdOrgTelly,
            d.DateCreate,
            d.DateUsage,
            d.IdUOMTblLebar,
            d.IdUOMPanjang,
            d.NoSPK,
            d.Jam,
            d.IsReject,
            d.NoLaminatingAsal,
            d.NoFJAsal,
            d.IdWarehouse,
            d.IdFJProfile,
            d.IdLokasi,
            d.IsLembur,
            d.HasBeenPrinted,
            d.IdFisik,
            d.NoSPKAsal,
            d.Remark,
            d.LastPrintDate,
            d.NoSPKTujuan
          FROM deleted d
          ORDER BY d.NoCCAkhir
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
        'CCAkhir_h',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoCCAkhir,
            d.IdJenisKayu,
            d.IdGrade,
            d.IdOrgTelly,
            d.DateCreate,
            d.DateUsage,
            d.IdUOMTblLebar,
            d.IdUOMPanjang,
            d.NoSPK,
            d.Jam,
            d.IsReject,
            d.NoLaminatingAsal,
            d.NoFJAsal,
            d.IdWarehouse,
            d.IdFJProfile,
            d.IdLokasi,
            d.IsLembur,
            d.HasBeenPrinted,
            d.IdFisik,
            d.NoSPKAsal,
            d.Remark,
            d.LastPrintDate,
            d.NoSPKTujuan
          FROM deleted d
          ORDER BY d.NoCCAkhir
          FOR JSON PATH
        ),
        (
          SELECT
            i.NoCCAkhir,
            i.IdJenisKayu,
            i.IdGrade,
            i.IdOrgTelly,
            i.DateCreate,
            i.DateUsage,
            i.IdUOMTblLebar,
            i.IdUOMPanjang,
            i.NoSPK,
            i.Jam,
            i.IsReject,
            i.NoLaminatingAsal,
            i.NoFJAsal,
            i.IdWarehouse,
            i.IdFJProfile,
            i.IdLokasi,
            i.IsLembur,
            i.HasBeenPrinted,
            i.IdFisik,
            i.NoSPKAsal,
            i.Remark,
            i.LastPrintDate,
            i.NoSPKTujuan
          FROM inserted i
          ORDER BY i.NoCCAkhir
          FOR JSON PATH
        );
    END
  END TRY
  BEGIN CATCH
    PRINT CONCAT('[AUDIT_WARN][tr_Audit_CCAkhir_h] ', ERROR_MESSAGE());
  END CATCH
END;
GO
