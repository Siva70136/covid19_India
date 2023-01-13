const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDb = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(4000);
    console.log("server started at http://localhost:4000");
  } catch (e) {
    console.log(`error message ${e.message}`);
  }
};

initializeDb();
const convertResponseObj = (data) => {
  return {
    stateId: data.state_id,
    stateName: data.state_name,
    population: data.population,
  };
};

const convertResponseObj1 = (data) => {
  return {
    districtID: data.district_id,
    districtName: data.district_name,
    stateId: data.state_id,
    cases: data.cases,
    cured: data.cured,
    active: data.active,
    deaths: data.deaths,
  };
};

const authentication = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const getQuery = `SELECT * FROM user WHERE username='${username}'`;
  const data = await db.get(getQuery);

  if (data === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPassword = await bcrypt.compare(password, data.password);
    if (isPassword === true) {
      const payload = {
        username: username,
      };
      response.status(200);
      const jwtToken = jwt.sign(payload, "SECRET");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authentication, async (request, response) => {
  const getQuery = `SELECT * FROM state;`;

  const getObj = await db.all(getQuery);

  response.send(getObj.map((eachObj) => convertResponseObj(eachObj)));
});

app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const getQuery = `SELECT * FROM state WHERE state_id="${stateId}";`;

  const getObj = await db.get(getQuery);

  response.send(convertResponseObj(getObj));
});

app.post("/districts/", authentication, async (request, response) => {
  const district = request.body;

  const { districtName, stateId, cases, cured, active, deaths } = district;

  const postQuery = `INSERT INTO district (district_name, state_id, cases, cured, active, deaths) VALUES ('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`;

  const getObj = await db.run(postQuery);

  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getQuery = `SELECT * FROM district WHERE district_id=${districtId};`;

    const getObj = await db.get(getQuery);

    response.send(convertResponseObj1(getObj));
  }
);

app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getQuery = `DELETE FROM district WHERE district_id="${districtId}";`;

    const getObj = await db.run(getQuery);

    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const district = request.body;
    const { districtId } = request.params;
    const { districtName, stateId, cases, cured, active, deaths } = district;

    const postQuery = `UPDATE district SET district_name='${districtName}', state_id='${stateId}', cases='${cases}', cured='${cured}', active='${active}', deaths='${deaths}' WHERE district_id="${districtId}" ;`;

    const getObj = await db.run(postQuery);

    response.send("District Details Updated");
  }
);

const stats = (data) => {
  return {
    totalCases: data.totalCases,
    totalCured: data.totalCured,
    totalActive: data.totalActive,
    totalDeaths: data.totalDeaths,
  };
};

app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const getQuery = `SELECT SUM(cases) as totalCases,SUM(cured) as totalCured,SUM(active) as totalActive,SUM(Deaths) as totalDeaths FROM district WHERE state_id="${stateId}";`;

    const getObj = await db.get(getQuery);

    response.send(stats(getObj));
  }
);

module.exports = app;
