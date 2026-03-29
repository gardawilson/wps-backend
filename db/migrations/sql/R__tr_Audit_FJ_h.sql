/* ===== [dbo].[tr_Audit_FJ_h] ON [dbo].[FJ_h] ===== */
CREATE OR ALTER TRIGGER [dbo].[tr_Audit_FJ_h]
ON [dbo].[FJ_h]
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
       PK yang dipakai: NoFJ
       - single: {"NoFJ":"..."}
       - multi : {"PKList":[{"NoFJ":"..."}, ...]}
    ========================================================= */
    DECLARE @pkMax int = COALESCE(NULLIF(COL_LENGTH('dbo.AuditTrail','PK') / 2, 0), 800);
    DECLARE @pk nvarchar(max);

    ;WITH x AS (
      SELECT NoFJ FROM inserted
      UNION
      SELECT NoFJ FROM deleted
    )
    SELECT
      @pk =
        CASE
          WHEN COUNT(1) = 1
            THEN CONCAT('{"NoFJ":"', MAX(NoFJ), '"}')
          ELSE
            CONCAT(
              '{"PKList":',
              (SELECT NoFJ FROM x ORDER BY NoFJ FOR JSON PATH),
              '}'
            )
        END
    FROM x;

    IF @pk IS NOT NULL AND LEN(@pk) > @pkMax
    BEGIN
      ;WITH x AS (
        SELECT NoFJ FROM inserted
        UNION
        SELECT NoFJ FROM deleted
      )
      SELECT
        @pk = CONCAT(
          '{"PKListSummary":{"Count":', COUNT(1),
          ',"First":"', MIN(NoFJ),
          '","Last":"', MAX(NoFJ), '"}}'
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
        'FJ_h',
        @actor,
        @rid,
        @pk,
        NULL,
        (
          SELECT
            i.NoFJ,
            i.IdJenisKayu,
            i.IdGrade,
            i.IdOrgTelly,
            i.DateCreate,
            i.DateUsage,
            i.NoS4SAsal,
            i.IdUOMTblLebar,
            i.IdUOMPanjang,
            i.NoSPK,
            i.Jam,
            i.IsReject,
            i.IsSisa,
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
          ORDER BY i.NoFJ
          FOR JSON PATH
        );
    END

    /* DELETE */
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'DELETE',
        'FJ_h',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoFJ,
            d.IdJenisKayu,
            d.IdGrade,
            d.IdOrgTelly,
            d.DateCreate,
            d.DateUsage,
            d.NoS4SAsal,
            d.IdUOMTblLebar,
            d.IdUOMPanjang,
            d.NoSPK,
            d.Jam,
            d.IsReject,
            d.IsSisa,
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
          ORDER BY d.NoFJ
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
        INNER JOIN deleted d ON i.NoFJ = d.NoFJ
        WHERE ISNULL(i.HasBeenPrinted, 0) <> ISNULL(d.HasBeenPrinted, 0)
      )
      BEGIN
        SET @action = 'PRINT';
      END

      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        @action,
        'FJ_h',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoFJ,
            d.IdJenisKayu,
            d.IdGrade,
            d.IdOrgTelly,
            d.DateCreate,
            d.DateUsage,
            d.NoS4SAsal,
            d.IdUOMTblLebar,
            d.IdUOMPanjang,
            d.NoSPK,
            d.Jam,
            d.IsReject,
            d.IsSisa,
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
          ORDER BY d.NoFJ
          FOR JSON PATH
        ),
        (
          SELECT
            i.NoFJ,
            i.IdJenisKayu,
            i.IdGrade,
            i.IdOrgTelly,
            i.DateCreate,
            i.DateUsage,
            i.NoS4SAsal,
            i.IdUOMTblLebar,
            i.IdUOMPanjang,
            i.NoSPK,
            i.Jam,
            i.IsReject,
            i.IsSisa,
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
          ORDER BY i.NoFJ
          FOR JSON PATH
        );
    END
  END TRY
  BEGIN CATCH
    PRINT CONCAT('[AUDIT_WARN][tr_Audit_FJ_h] ', ERROR_MESSAGE());
  END CATCH
END;
GO
