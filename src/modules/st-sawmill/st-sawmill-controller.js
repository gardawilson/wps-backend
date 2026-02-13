const service = require("./st-sawmill-service");

exports.getProdukSpk = async (req, res) => {
  const { Tebal, Lebar, IdJenisKayu } = req.query;
  const { username } = req;

  console.log("🔍 Fetching Produk SPK | User:", username);

  if (!Tebal || !Lebar || !IdJenisKayu) {
    return res.status(400).json({
      success: false,
      message: "Tebal, Lebar, dan IdJenisKayu wajib diisi",
    });
  }

  try {
    const data = await service.getProdukSpk({
      Tebal,
      Lebar,
      IdJenisKayu,
    });

    if (!data.length) {
      return res.status(404).json({
        success: false,
        message: "Data tidak ditemukan",
        data: [],
      });
    }

    return res.json({
      success: true,
      message: "Data berhasil diambil",
      data,
      totalData: data.length,
    });
  } catch (error) {
    console.error("Error getProdukSpk:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.getSisaTon = async (req, res) => {
  const { NoSPK, IdProdukSPK } = req.query;
  const { username } = req;

  console.log("🔍 Checking SisaTon | User:", username);

  if (!NoSPK || !IdProdukSPK) {
    return res.status(400).json({
      success: false,
      message: "NoSPK dan IdProdukSPK wajib diisi",
    });
  }

  try {
    const result = await service.getSisaTon({
      NoSPK,
      IdProdukSPK,
    });

    return res.json({
      success: true,
      message: "Sisa ton berhasil dihitung",
      data: result,
    });
  } catch (error) {
    console.error("Error getSisaTon:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
