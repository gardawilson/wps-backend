/* ===== [dbo].[tr_Audit_ST_h] ON [dbo].[ST_h] ===== */
  CREATE OR ALTER TRIGGER [dbo].[tr_Audit_ST_h]
  ON [dbo].[ST_h]
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

      -- Ikuti panjang kolom AuditTrail agar tidak overflow
      DECLARE @pkMax int = COALESCE(NULLIF(COL_LENGTH('dbo.AuditTrail','PK') / 2, 0), 800);
      DECLARE @pk nvarchar(max);

      ;WITH x AS (
        SELECT NoST FROM inserted
        UNION
        SELECT NoST FROM deleted
      )
      SELECT
        @pk =
          CASE
            WHEN COUNT(1) = 1
              THEN CONCAT('{"NoST":"', MAX(NoST), '"}')
            ELSE
              CONCAT('{"PKList":', (SELECT NoST FROM x ORDER BY NoST FOR JSON PATH), '}')
          END
      FROM x;

      -- Jika kepanjangan, pakai ringkasan agar tidak gagal insert audit
      IF @pk IS NOT NULL AND LEN(@pk) > @pkMax
      BEGIN
        ;WITH x AS (
          SELECT NoST FROM inserted
          UNION
          SELECT NoST FROM deleted
        )
        SELECT
          @pk = CONCAT(
            '{"PKListSummary":{"Count":', COUNT(1),
            ',"First":"', MIN(NoST),
            '","Last":"', MAX(NoST), '"}}'
          )
        FROM x;
      END;

      -- Hard cap terakhir
      SET @pk = LEFT(@pk, @pkMax);
      SET @actor = LEFT(@actor, 128);
      SET @rid = LEFT(@rid, 64);

      /* INSERT */
      IF EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted)
      BEGIN
        INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
        SELECT
          'INSERT',
          'ST_h',
          @actor,
          @rid,
          @pk,
          NULL,
          (
            SELECT
              i.NoST, i.IdJenisKayu, i.DateCreate, i.DateUsage, i.NoKayuBulat,
              i.IdUOMTblLebar, i.IdUOMPanjang, i.IdStickBy, i.IdOrgTelly, i.NoSPK,
              i.IsUpah, i.StartKering, i.IsSticked, i.IdLokasi, i.HasBeenPrinted,
              i.IsBagusKulit, i.IsSLP, i.Remark, i.VacuumDate, i.LastPrintDate, i.NoSPKTujuan
            FROM inserted i
            ORDER BY i.NoST
            FOR JSON PATH
          );
      END

      /* DELETE */
      IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
      BEGIN
        INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
        SELECT
          'DELETE',
          'ST_h',
          @actor,
          @rid,
          @pk,
          (
            SELECT
              d.NoST, d.IdJenisKayu, d.DateCreate, d.DateUsage, d.NoKayuBulat,
              d.IdUOMTblLebar, d.IdUOMPanjang, d.IdStickBy, d.IdOrgTelly, d.NoSPK,
              d.IsUpah, d.StartKering, d.IsSticked, d.IdLokasi, d.HasBeenPrinted,
              d.IsBagusKulit, d.IsSLP, d.Remark, d.VacuumDate, d.LastPrintDate, d.NoSPKTujuan
            FROM deleted d
            ORDER BY d.NoST
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
          INNER JOIN deleted d ON i.NoST = d.NoST
          WHERE ISNULL(i.HasBeenPrinted, 0) <> ISNULL(d.HasBeenPrinted, 0)
        )
        BEGIN
          SET @action = 'PRINT';
        END

        INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
        SELECT
          @action,
          'ST_h',
          @actor,
          @rid,
          @pk,
          (
            SELECT
              d.NoST, d.IdJenisKayu, d.DateCreate, d.DateUsage, d.NoKayuBulat,
              d.IdUOMTblLebar, d.IdUOMPanjang, d.IdStickBy, d.IdOrgTelly, d.NoSPK,
              d.IsUpah, d.StartKering, d.IsSticked, d.IdLokasi, d.HasBeenPrinted,
              d.IsBagusKulit, d.IsSLP, d.Remark, d.VacuumDate, d.LastPrintDate, d.NoSPKTujuan
            FROM deleted d
            ORDER BY d.NoST
            FOR JSON PATH
          ),
          (
            SELECT
              i.NoST, i.IdJenisKayu, i.DateCreate, i.DateUsage, i.NoKayuBulat,
              i.IdUOMTblLebar, i.IdUOMPanjang, i.IdStickBy, i.IdOrgTelly, i.NoSPK,
              i.IsUpah, i.StartKering, i.IsSticked, i.IdLokasi, i.HasBeenPrinted,
              i.IsBagusKulit, i.IsSLP, i.Remark, i.VacuumDate, i.LastPrintDate, i.NoSPKTujuan
            FROM inserted i
            ORDER BY i.NoST
            FOR JSON PATH
          );
      END
    END TRY
    BEGIN CATCH
      -- Non-blocking audit: jangan gagalkan transaksi utama
      PRINT CONCAT('[AUDIT_WARN][tr_Audit_ST_h] ', ERROR_MESSAGE());
    END CATCH
  END;
  GO
