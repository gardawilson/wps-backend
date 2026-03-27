/* ===== [dbo].[tr_Audit_Sanding_d] ON [dbo].[Sanding_d] ===== */
CREATE OR ALTER TRIGGER [dbo].[tr_Audit_Sanding_d]
ON [dbo].[Sanding_d]
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
       PK yang dipakai: NoSanding
       - single: {"NoSanding":"..."}
       - multi : {"PKList":[{"NoSanding":"..."}, ...]}
    ========================================================= */
    DECLARE @pkMax int = COALESCE(NULLIF(COL_LENGTH('dbo.AuditTrail','PK') / 2, 0), 800);
    DECLARE @pk nvarchar(max);

    ;WITH x AS (
      SELECT NoSanding FROM inserted
      UNION
      SELECT NoSanding FROM deleted
    )
    SELECT
      @pk =
        CASE
          WHEN COUNT(1) = 1
            THEN CONCAT('{"NoSanding":"', MAX(NoSanding), '"}')
          ELSE
            CONCAT(
              '{"PKList":',
              (SELECT NoSanding FROM x ORDER BY NoSanding FOR JSON PATH),
              '}'
            )
        END
    FROM x;

    IF @pk IS NOT NULL AND LEN(@pk) > @pkMax
    BEGIN
      ;WITH x AS (
        SELECT NoSanding FROM inserted
        UNION
        SELECT NoSanding FROM deleted
      )
      SELECT
        @pk = CONCAT(
          '{"PKListSummary":{"Count":', COUNT(1),
          ',"First":"', MIN(NoSanding),
          '","Last":"', MAX(NoSanding), '"}}'
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
        'Sanding_d',
        @actor,
        @rid,
        @pk,
        NULL,
        (
          SELECT
            i.NoSanding,
            i.NoUrut,
            TRY_CONVERT(decimal(18,3), i.Tebal)   AS Tebal,
            TRY_CONVERT(decimal(18,3), i.Lebar)   AS Lebar,
            TRY_CONVERT(decimal(18,3), i.Panjang) AS Panjang,
            i.JmlhBatang
          FROM inserted i
          ORDER BY i.NoSanding, i.NoUrut
          FOR JSON PATH
        );
    END

    /* DELETE */
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    BEGIN
      INSERT dbo.AuditTrail(Action, TableName, Actor, RequestId, PK, OldData, NewData)
      SELECT
        'DELETE',
        'Sanding_d',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoSanding,
            d.NoUrut,
            TRY_CONVERT(decimal(18,3), d.Tebal)   AS Tebal,
            TRY_CONVERT(decimal(18,3), d.Lebar)   AS Lebar,
            TRY_CONVERT(decimal(18,3), d.Panjang) AS Panjang,
            d.JmlhBatang
          FROM deleted d
          ORDER BY d.NoSanding, d.NoUrut
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
        'Sanding_d',
        @actor,
        @rid,
        @pk,
        (
          SELECT
            d.NoSanding,
            d.NoUrut,
            TRY_CONVERT(decimal(18,3), d.Tebal)   AS Tebal,
            TRY_CONVERT(decimal(18,3), d.Lebar)   AS Lebar,
            TRY_CONVERT(decimal(18,3), d.Panjang) AS Panjang,
            d.JmlhBatang
          FROM deleted d
          ORDER BY d.NoSanding, d.NoUrut
          FOR JSON PATH
        ),
        (
          SELECT
            i.NoSanding,
            i.NoUrut,
            TRY_CONVERT(decimal(18,3), i.Tebal)   AS Tebal,
            TRY_CONVERT(decimal(18,3), i.Lebar)   AS Lebar,
            TRY_CONVERT(decimal(18,3), i.Panjang) AS Panjang,
            i.JmlhBatang
          FROM inserted i
          ORDER BY i.NoSanding, i.NoUrut
          FOR JSON PATH
        );
    END
  END TRY
  BEGIN CATCH
    PRINT CONCAT('[AUDIT_WARN][tr_Audit_Sanding_d] ', ERROR_MESSAGE());
  END CATCH
END;
GO
