const fetch = require("cross-fetch");

//#region Set up Alpaca API Keys
require("dotenv").config();
const APCA_API_KEY_ID = process.env.APCA_API_KEY_ID;
const APCA_API_SECRET_KEY = process.env.APCA_API_SECRET_KEY;
const headers = {
  "APCA-API-KEY-ID": APCA_API_KEY_ID,
  "APCA-API-SECRET-KEY": APCA_API_SECRET_KEY,
};
//#endregion

//#region Express Server
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = process.env.EA_PORT || 8080;
const host = process.env.EA_HOST || "172.17.0.1";

app.use(bodyParser.json());
app.listen(port, host, () => console.log(`Listening on port ${port}!`));

//#endregion

//#region EA's
//Return asking price of the Equity symbol on the exchange given
const getEquitiesPrice = async (input) => {
  const jobRunId = typeof input.id === "undefined" ? 1 : input.id;
  try {
    // Deconstruct the input
    const { symbol } = input.data;
    // Throw an error if symbol is not provided
    if (!symbol) throw new Error("Symbol is required");
    // Construct the URL using the symbol
    const url = `https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`;
    // Make the request
    const response = await fetch(url, { headers });
    // Parse the response
    const data = await response.json();
    // Calculate the price in dollars -> We should ideally do it in cents.
    // Reason for why we should do it in cents here is because later when we host it on a
    // Chailink node, solidity is only able to handle integers. So we are converting it to cents
    // here.
    const price = data.quote.ap;
    // Return status and price as result
    return {
      status: response.status,
      result: { jobRunId, price },
    };
  } catch (error) {
    return {
      status: 500,
      result: {
        jobRunId, status: "errored", error: "AdapterError", message: error.message, statusCode: 500,
      }
    }
  }
};

// Trade crypto/equities on Alpaca given symbol, qty and side of the trade
const tradeAlpaca = async (input) => {
  const jobRunId = typeof input.id === "undefined" ? 1 : input.id;
  try {
    // Deconstruct the input
    const { symbol, qty , side} = input.data;
    // Throw an error if symbol is not provided
    if (!symbol) throw new Error("Symbol is required");
    // Throw an error if qty is not provided
    if (!qty) throw new Error("Quantity is required");
    // Throw an error if side is not provided
    if (!side) throw new Error("Buy/Sell Side is required");
    // Construct the body of the request
    const body = {symbol, qty, side, type:"market", time_in_force:"day"};
    // Construct the URL using body
    const url = `https://paper-api.alpaca.markets/v2/orders`;
    // Make the request
    const response = await fetch(url, { headers, body: JSON.stringify(body), method: 'POST' });
    // Parse the response
    const data = await response.json();
    // Retreieve the order status
    const orderStatus = data.status;
    // Return request status and order status as result
    return {
      status: response.status,
      result: { jobRunId, orderStatus },
    };
  } catch (error) {
    return {
      status: 500,
      result: {
        jobRunId, status: "errored", error: "AdapterError", message: error.message, statusCode: 500,
      }
    }
  }
};

//EA to get asking price of the symbol on the exchange given
const getCryptoPrice = async (input) => {
  const jobRunId = typeof input.id === "undefined" ? 1 : input.id;
  try {
    // Deconstruct the input
    const { exchange, symbol } = input.data;
    if (!exchange) throw new Error("Data is required");
    if (!symbol) throw new Error("Symbol is required");
    // Construct the URL using the exchange and symbol
    const url = `https://data.alpaca.markets/v1beta1/crypto/${symbol}/quotes/latest?exchange=${exchange}`;
    // Make the request
    const response = await fetch(url, { headers });
    // Parse the response
    const data = await response.json();
    // Calculate the price in cents -> reason we do it in cents here is because later when we host it on a
    // Chailink node, solidity is only able to handle integers
    const price = Math.floor(data.quote.ap * 100);
    // Return status and price as result
    return {
      status: response.status,
      result: { jobRunId, price },
    };
  } catch (error) {
    return {
      status: 500,
      result: {
        jobRunId, status: "errored", error: "AdapterError", message: error.message, statusCode: 500,
      }
    }
  }
};

// EA to get Crypto Asking size from Alpaca
const getCryptoAskingSize = async (input) => {
  const jobRunId = typeof input.id === "undefined" ? 1 : input.id;
  try {
    // Deconstruct the input
    const { exchange, symbol } = input.data;
    if (!exchange) throw new Error("Data is required");
    if (!symbol) throw new Error("Symbol is required");
    // Construct the URL using the exchange and symbol
    const url = `https://data.alpaca.markets/v1beta1/crypto/${symbol}/quotes/latest?exchange=${exchange}`;
    // Make the request
    const response = await fetch(url, { headers });
    // Parse the response
    const data = await response.json();
    // Return status and asking size as result
    return {
      status: response.status,
      result: { jobRunId, askingSize: data.quote.as },
    };
  } catch (error) {
    return {
      status: 500,
      result: {
        jobRunId, status: "errored", error: "AdapterError", message: error.message, statusCode: 500,
      },
    };
  }
};
//#endregion

//#region routes
// Route to get Crypto Asking size from Alpaca
app.post("/cryptoaskingsize", async (req, res) => {
  const { status, result } = await getCryptoAskingSize(req.body);
  res.status(status).json(result);
});
// Route to get asking price of the crypto given a symbol and an exchange
app.post("/cryptoprice", async (req, res) => {
  const { status, result } = await getCryptoPrice(req.body);
  res.status(status).json(result);
});
// Route to trade crypto/equities on Alpaca
app.post("/alpacatrade", async (req, res) => {
  const { status, result } = await tradeAlpaca(req.body);
  res.status(status).json(result);
});
// Route to get asking price of the Equity symbol 
app.post("/equitiesprice", async (req, res) => {
  const { status, result } = await getEquitiesPrice(req.body);
  res.status(status).json(result);
});
//#endregion

