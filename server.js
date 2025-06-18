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

// Almacén de conexiones y modelos
let dbRegistry = {};

// Middleware para verificar conexión
function validateConnection(req, res, next) {
  const { connectionName } = req.params;
  if (!dbRegistry[connectionName]) {
    return res
      .status(404)
      .json({ error: `Conexión '${connectionName}' no encontrada` });
  }
  req.db = dbRegistry[connectionName];
  next();
}

// 1. Ruta para crear conexión
app.post("/connections", async (req, res) => {
  const { connectionName, dbPath } = req.body;

  //console.log(dbRegistry[connectionName]);

  if (!connectionName || !dbPath) {
    return res
      .status(400)
      .json({ error: "Se requieren connectionName y dbPath" });
  }

  if (dbRegistry[connectionName]) {
    return (
      res
        //.status(400)
        .json({ error: "El nombre de conexión ya está en uso" })
    );
  }

  //console.log(dbRegistry[connectionName]);

  try {
    const sequelize = new Sequelize({
      dialect: "sqlite",
      define: {
        timestamps: false,
        createdAt: false,
        updatedAt: false,
      },
      storage: dbPath,
      logging: console.log, // Opcional: para depuración
    });

    await sequelize.authenticate();

    // Estructura para almacenar la conexión y modelos
    dbRegistry[connectionName] = {
      sequelize,
      models: {},
    };

    res.json({
      success: true,
      message: `Conexión '${connectionName}' establecida con ${dbPath}`,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error al conectar a la base de datos",
      details: error.message,
    });
  }
});

// 2. Ruta para definir un modelo
app.post("/:connectionName/models", validateConnection, async (req, res) => {
  const { connectionName } = req.params;
  const { modelName, attributes } = req.body;

  if (!modelName || !attributes) {
    return res
      .status(400)
      .json({ error: "Se requieren modelName y attributes" });
  }

  let newAttrib = {};
  //const fechaActual = new Date();
  //const fechaFormateada = fechaActual.toISOString().slice(0, 19).replace('T', ' ');
  Object.entries(attributes).forEach(([key, value]) => {
    if (value === "STRING") {
      newAttrib[key] = { type: DataTypes.STRING(100) };
    } else if (value === "REAL") {
      newAttrib[key] = { type: DataTypes.REAL };
    } else if (value === "INTEGER") {
      if (key === "status" || key === "exento") {
        newAttrib[key] = { type: DataTypes.INTEGER, defaultValue: 0 };
      } else {
        newAttrib[key] = { type: DataTypes.INTEGER };
      }
    } else if (value === "TEXT") {
      newAttrib[key] = { type: DataTypes.TEXT };
    }
  });

  try {
    const model = req.db.sequelize.define(modelName, newAttrib);
    await model.sync();
    req.db.models[modelName] = model;

    /*if (modelName === "configs") {
        await model.create({
          viewMode: "list",
        });
      }*/

    res.json({
      success: true,
      message: `Modelo '${modelName}' creado en '${connectionName}'`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Rutas CRUD para cada modelo

// CREATE (POST)
app.post(
  "/:connectionName/:modelName",
  validateConnection,
  async (req, res) => {
    const { modelName } = req.params;
    const model = req.db.models[modelName];

    if (!model) {
      return res
        .status(404)
        .json({ error: `Modelo '${modelName}' no encontrado` });
    }

    try {
      const record = await model.create(req.body);
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// READ ALL (GET)
app.get("/:connectionName/:modelName", validateConnection, async (req, res) => {
  const { modelName } = req.params;
  const model = req.db.models[modelName];

  if (!model) {
    return res
      .status(404)
      .json({ error: `Modelo '${modelName}' no encontrado` });
  }

  try {
    const records = await model.findAll();
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// READ ONE (GET)
app.get(
  "/:connectionName/:modelName/:id",
  validateConnection,
  async (req, res) => {
    const { modelName, id } = req.params;
    const model = req.db.models[modelName];

    if (!model) {
      return res
        .status(404)
        .json({ error: `Modelo '${modelName}' no encontrado` });
    }

    try {
      const record = await model.findByPk(id);
      if (!record) {
        return res.status(404).json({ error: "Registro no encontrado" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// UPDATE (PUT)
app.put(
  "/:connectionName/:modelName/:id",
  validateConnection,
  async (req, res) => {
    const { modelName, id } = req.params;
    const model = req.db.models[modelName];

    if (!model) {
      return res
        .status(404)
        .json({ error: `Modelo '${modelName}' no encontrado` });
    }

    try {
      const [updated] = await model.update(req.body, {
        where: { id },
      });
      if (updated) {
        const updatedRecord = await model.findByPk(id);
        res.json(updatedRecord);
      } else {
        res.status(404).json({ error: "Registro no encontrado" });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// DELETE (DELETE)
app.delete(
  "/:connectionName/:modelName/:id",
  validateConnection,
  async (req, res) => {
    const { modelName, id } = req.params;
    const model = req.db.models[modelName];

    if (!model) {
      return res
        .status(404)
        .json({ error: `Modelo '${modelName}' no encontrado` });
    }

    try {
      const deleted = await model.destroy({
        where: { id },
      });

      if (deleted) {
        res.json({ success: true, message: "Registro eliminado" });
      } else {
        res.status(404).json({ error: "Registro no encontrado" });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

app.get("/tasa", async (req, res) => {
  const tasa = await scrapeBCV();
  return res.json(tasa);
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
