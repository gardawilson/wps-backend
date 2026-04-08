/* ===== [dbo].[tr_Audit_BongkarSusun_h] ON [dbo].[BongkarSusun_h] ===== */
CREATE OR ALTER TRIGGER [dbo].[tr_Audit_BongkarSusun_h]
ON [dbo].[BongkarSusun_h]
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
       PK yang dipakai: NoBongkarSusun
       - single: {"NoBongkarSusun":"..."}
       - multi : {"PKList":[{"NoBongkarSusun":"..."}, ...]}
    ========================================================= */
    DECLARE @pkMax int = COALESCE(NULLIF(COL_LENGTH('dbo.AuditTrail','PK') / 2, 0), 800);
    DECLARE @pk nvarchar(max);

    ;WITH x AS (
      SELECT NoBongkarSusun FROM inserted
      UNION
      SELECT NoBongkarSusun FROM deleted
    )
    SELECT
      @pk =
        CASE
          WHEN COUNT(1) = 1
            THEN CONCAT('{"NoBongkarSusun":"', MAX(NoBongkarSusun), '"}')
          ELSE
            CONCAT(
              '{"PKList":',
              (SELECT NoBongkarSusun FROM x ORDER BY NoBongkarSusun FOR JSON PATH),
              '}'
            )
        END
    FROM x;

    IF @pk IS NOT NULL AND LEN(@pk) > @pkMax
    BEGIN
      ;WITH x AS (
        SELECT NoBongkarSusun FROM inserted
        UNION
        SELECT NoBongkarSusun FROM deleted
      )
      SELECT
        @pk = CONCAT(
          '{"PKListSummary":{"Count":', COUNT(1),
          ',"First":"', MIN(NoBongkarSusun),
          '","Last":"', MAX(NoBongkarSusun), '"}}'
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
        'BongkarSusun_h',
        @actor,
        @rid,
        @pk,
        NULL,
        (
          SELECT
            i.NoBongkarSusun,
            i.Tanggal,
            i.IsPemakaian,
            i.NoPenerimaanST,
            i.Keterangan
          FROM inserted i
          ORDER BY i.NoBongkarSusun
          FOR JSON PATH
        );
    END

    /* DELETE */
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'DELETE',
        'BongkarSusun_h',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoBongkarSusun,
            d.Tanggal,
            d.IsPemakaian,
            d.NoPenerimaanST,
            d.Keterangan
          FROM deleted d
          ORDER BY d.NoBongkarSusun
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
        'BongkarSusun_h',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoBongkarSusun,
            d.Tanggal,
            d.IsPemakaian,
            d.NoPenerimaanST,
            d.Keterangan
          FROM deleted d
          ORDER BY d.NoBongkarSusun
          FOR JSON PATH
        ),
        (
          SELECT
            i.NoBongkarSusun,
            i.Tanggal,
            i.IsPemakaian,
            i.NoPenerimaanST,
            i.Keterangan
          FROM inserted i
          ORDER BY i.NoBongkarSusun
          FOR JSON PATH
        );
    END
  END TRY
  BEGIN CATCH
    PRINT CONCAT('[AUDIT_WARN][tr_Audit_BongkarSusun_h] ', ERROR_MESSAGE());
  END CATCH
END;
GO
