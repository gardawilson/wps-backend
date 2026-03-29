/* ===== [dbo].[tr_Audit_Moulding_h] ON [dbo].[Moulding_h] ===== */
CREATE OR ALTER TRIGGER [dbo].[tr_Audit_Moulding_h]
ON [dbo].[Moulding_h]
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
       PK yang dipakai: NoMoulding
       - single: {"NoMoulding":"..."}
       - multi : {"PKList":[{"NoMoulding":"..."}, ...]}
    ========================================================= */
    DECLARE @pkMax int = COALESCE(NULLIF(COL_LENGTH('dbo.AuditTrail','PK') / 2, 0), 800);
    DECLARE @pk nvarchar(max);

    ;WITH x AS (
      SELECT NoMoulding FROM inserted
      UNION
      SELECT NoMoulding FROM deleted
    )
    SELECT
      @pk =
        CASE
          WHEN COUNT(1) = 1
            THEN CONCAT('{"NoMoulding":"', MAX(NoMoulding), '"}')
          ELSE
            CONCAT(
              '{"PKList":',
              (SELECT NoMoulding FROM x ORDER BY NoMoulding FOR JSON PATH),
              '}'
            )
        END
    FROM x;

    IF @pk IS NOT NULL AND LEN(@pk) > @pkMax
    BEGIN
      ;WITH x AS (
        SELECT NoMoulding FROM inserted
        UNION
        SELECT NoMoulding FROM deleted
      )
      SELECT
        @pk = CONCAT(
          '{"PKListSummary":{"Count":', COUNT(1),
          ',"First":"', MIN(NoMoulding),
          '","Last":"', MAX(NoMoulding), '"}}'
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
        'Moulding_h',
        @actor,
        @rid,
        @pk,
        NULL,
        (
          SELECT
            i.NoMoulding,
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
            i.NoFJAsal,
            i.NoS4SAsal,
            i.NoCCAkhir,
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
          ORDER BY i.NoMoulding
          FOR JSON PATH
        );
    END

    /* DELETE */
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'DELETE',
        'Moulding_h',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoMoulding,
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
            d.NoFJAsal,
            d.NoS4SAsal,
            d.NoCCAkhir,
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
          ORDER BY d.NoMoulding
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
        INNER JOIN deleted d ON i.NoMoulding = d.NoMoulding
        WHERE ISNULL(i.HasBeenPrinted, 0) <> ISNULL(d.HasBeenPrinted, 0)
      )
      BEGIN
        SET @action = 'PRINT';
      END

      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        @action,
        'Moulding_h',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoMoulding,
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
            d.NoFJAsal,
            d.NoS4SAsal,
            d.NoCCAkhir,
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
          ORDER BY d.NoMoulding
          FOR JSON PATH
        ),
        (
          SELECT
            i.NoMoulding,
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
            i.NoFJAsal,
            i.NoS4SAsal,
            i.NoCCAkhir,
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
          ORDER BY i.NoMoulding
          FOR JSON PATH
        );
    END
  END TRY
  BEGIN CATCH
    PRINT CONCAT('[AUDIT_WARN][tr_Audit_Moulding_h] ', ERROR_MESSAGE());
  END CATCH
END;
GO
