const express = require("express");
const { Sequelize, Model, DataTypes, json } = require("sequelize");
let cors = require("cors");
const https = require("https");
const app = express();
const axios = require("axios");
const bodyParser = require("body-parser");

app.use(cors());
app.use(bodyParser.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Credentials", true);
  next();
});

app.use(express.json());

const sequelizeA = new Sequelize({
  dialect: "sqlite",
  storage: `data.sqlite`,
  logging: console.log,
});
sequelizeA.sync();
class User extends Model {}
User.init(
  {
    username: DataTypes.TEXT,
    email: DataTypes.TEXT,
    password: DataTypes.TEXT,
    created_at: DataTypes.TEXT,
  },
  {
    sequelize: sequelizeA,
    modelName: "users",
    timestamps: false,
    createdAt: false,
    updatedAt: false,
  }
);

class Configuracion extends Model {}
Configuracion.init(
  {
    info: DataTypes.STRING,
    usd: DataTypes.REAL,
    eur: DataTypes.REAL,
    cny: DataTypes.REAL,
    otros: DataTypes.STRING,
    alias: DataTypes.STRING,
  },
  {
    sequelize: sequelizeA,
    modelName: "configuraciones",
    timestamps: false,
    createdAt: false,
    updatedAt: false,
  }
);

app.get("/configuracion", async (req, res) => {
  try {
    const tasa = await scrapeBCV();
    const tasabcv = {
      usd: tasa.usd,
      eur: tasa.eur,
      cny: tasa.cny,
    };
    const [updated] = await Configuracion.update(tasabcv, {
      where: { id: 1 },
    });
    if (updated) {
      const updatedRecord = await Configuracion.findByPk(1);
      res.json(updatedRecord);
    } else {
      res.status(404).json({ error: "Registro no encontrado" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/configuracion/:id", async (req, res) => {
  try {
    if (req.body.token !== "$$**963852741tas") {
      return res.status(404).json({ error: "Error token!" });
    }
    const { id } = req.params;
    const tasabcv = {
      info: req.body.info,
      otros: req.body.otros,
      alias: req.body.alias,
    };
    const [updated] = await Configuracion.update(tasabcv, {
      where: { id },
    });
    if (updated) {
      const updatedRecord = await Configuracion.findByPk(id);
      res.json(updatedRecord);
    } else {
      res.status(404).json({ error: "Registro no encontrado" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/tasa", async (req, res) => {
  const configuracion = await Configuracion.findAll();
  return res.json(configuracion[0]);
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});

const convert = (numero) => {
  let parteDecimal = String(numero).split(",")[1]; // "345"
  let primerosDosDecimales = parteDecimal.substring(0, 2);
  let valorCompleto = parseFloat(parseInt(numero) + "." + primerosDosDecimales);
  return valorCompleto;
};

async function scrapeBCV() {
  try {
    const response = await axios.get("https://www.bcv.org.ve", {
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
    const cheerio = require("cheerio");
    const $ = cheerio.load(response.data);
    return {
      usd: convert($("#dolar strong").text().trim()),
      eur: convert($("#euro strong").text().trim()),
      cny: convert($("#yuan strong").text().trim()),
    };
  } catch (error) {
    throw new Error("Scraping fallido: " + error.message);
  }
}
