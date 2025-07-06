import express from "express";
import cors from "cors";
const app = express();
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
import morgan from "morgan";
import bodyParser from "body-parser";

import https from "https";
import axios from "axios";
import * as cheerio from "cheerio";

// using morgan for logs
app.use(morgan("combined"));

app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Credentials", true);
  next();
});

app.use(bodyParser.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.get("/configuraciones", async (req, res) => {
  const tasa = await scrapeBCV();
  const tasabcv = {
    usd: tasa.usd,
    eur: tasa.eur,
    cny: tasa.cny,
  };
  const { data, error } = await supabase
    .from("configuraciones")
    .update(tasabcv)
    .eq("id", 1)
    .select();

  res.send(data);
});

app.put("/configuracion", async (req, res) => {
  try {
    if (req.body.token !== "$$**963852741tas") {
      return res.status(404).json({ error: "Error token!" });
    }
    const informacion = {
      info: req.body.info,
      otros: req.body.otros,
      alias: req.body.alias,
      urlconversor: req.body.urlconversor,
      urlcalculadora: req.body.urlcalculadora,
    };
    const { data, error } = await supabase
      .from("configuraciones")
      .update(informacion)
      .eq("id", 1)
      .select();
    res.send(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/tasa", async (req, res) => {
  const { data, error } = await supabase.from("configuraciones").select();
  return res.json(data[0]);
});

app.get("/", (req, res) => {
  res.send("...");
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
