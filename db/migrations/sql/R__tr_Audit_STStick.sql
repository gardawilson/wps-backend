 /* ===== [dbo].[tr_Audit_STStick] ON [dbo].[STStick] ===== */
  CREATE OR ALTER TRIGGER [dbo].[tr_Audit_STStick]
  ON [dbo].[STStick]
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
         PK yang dipakai: NoST + IdGradeStick (composite)
         - single: {"NoST":"...","IdGradeStick":"..."}
         - multi : {"PKList":[{"NoST":"...","IdGradeStick":"..."}, ...]}
      ========================================================= */
      -- Ikuti panjang kolom AuditTrail agar tidak overflow
      DECLARE @pkMax int = COALESCE(NULLIF(COL_LENGTH('dbo.AuditTrail','PK') / 2, 0), 800);
      DECLARE @pk nvarchar(max);

      ;WITH x AS (
        SELECT NoST, IdGradeStick FROM inserted
        UNION
        SELECT NoST, IdGradeStick FROM deleted
      )
      SELECT
        @pk =
          CASE
            WHEN COUNT(1) = 1
              THEN CONCAT('{"NoST":"', MAX(NoST), '","IdGradeStick":"', MAX(IdGradeStick), '"}')
            ELSE
              CONCAT(
                '{"PKList":',
                (SELECT NoST, IdGradeStick FROM x ORDER BY NoST, IdGradeStick FOR JSON PATH),
                '}'
              )
          END
      FROM x;

      -- Jika kepanjangan, pakai ringkasan agar insert audit tidak gagal
      IF @pk IS NOT NULL AND LEN(@pk) > @pkMax
      BEGIN
        ;WITH x AS (
          SELECT NoST, IdGradeStick FROM inserted
          UNION
          SELECT NoST, IdGradeStick FROM deleted
        )
        SELECT
          @pk = CONCAT(
            '{"PKListSummary":{"Count":', COUNT(1),
            ',"FirstNoST":"', MIN(NoST),
            '","LastNoST":"', MAX(NoST), '"}}'
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
          'STStick',
          @actor,
          @rid,
          @pk,
          NULL,
          (
            SELECT
              i.NoST,
              i.IdGradeStick,
              i.JumlahStick
            FROM inserted i
            ORDER BY i.NoST, i.IdGradeStick
            FOR JSON PATH
          );
      END

      /* DELETE */
      IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
      BEGIN
        INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
        SELECT
          'DELETE',
          'STStick',
          @actor,
          @rid,
          @pk,
          (
            SELECT
              d.NoST,
              d.IdGradeStick,
              d.JumlahStick
            FROM deleted d
            ORDER BY d.NoST, d.IdGradeStick
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
          'STStick',
          @actor,
          @rid,
          @pk,
          (
            SELECT
              d.NoST,
              d.IdGradeStick,
              d.JumlahStick
            FROM deleted d
            ORDER BY d.NoST, d.IdGradeStick
            FOR JSON PATH
          ),
          (
            SELECT
              i.NoST,
              i.IdGradeStick,
              i.JumlahStick
            FROM inserted i
            ORDER BY i.NoST, i.IdGradeStick
            FOR JSON PATH
          );
      END
    END TRY
    BEGIN CATCH
      -- Non-blocking audit: jangan gagalkan transaksi utama
      PRINT CONCAT('[AUDIT_WARN][tr_Audit_STStick] ', ERROR_MESSAGE());
    END CATCH
  END;
  GO
