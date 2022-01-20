const express = require("express");
const router = express.Router();
const Request = require("../models/request");
const User = require("../models/user");
const Mailer = require("../mail/mailer");
const Sonarr = require("../services/sonarr");
const Radarr = require("../services/radarr");

const processRequest = require("../requests/process");
const { getRequests } = require("../requests/display");
const { getArchive } = require("../requests/archive");
const logger = require("../util/logger");

router.post("/add", async (req, res) => {
  let user = req.body.user;
  let request = req.body.request;
  let process = await new processRequest(request, user).new();
  res.json(process);
});

router.get("/min", async (req, res) => {
  const requests = await Request.find();
  let data = {};
  try {
    data = {};

    await Promise.all(
      requests.map(async (request, i) => {
        data[request.requestId] = {
          title: request.title,
          requestId: request.requestId,
          type: request.type,
          thumb: request.thumb,
          imdb_id: request.imdb_id,
          tmdb_id: request.tmdb_id,
          tvdb_id: request.tvdb_id,
          users: request.users,
          sonarrId: request.sonarrId,
          radarrId: request.radarrId,
          approved: request.approved,
          defaults: request.pendingDefault,
        };
        if (request.type === "tv") {
          data[request.requestId].seasons = request.seasons;
        }
      })
    );
  } catch (err) {
    logger.log("error", `ROUTE: Error getting requests`);
    logger.log({ level: "error", message: err });
  }
  res.json(data);
});

router.get("/me", async (req, res) => {
  let userId = req.jwtUser.id;
  if (!userId) {
    res.sendStatus(404);
  }
  let data = await getRequests(userId, false);
  res.json(data);
});

router.get("/all", async (req, res) => {
  let data = await getRequests(false, true);
  res.json(data);
});

router.post("/remove", async (req, res) => {
  let request = req.body.request;
  let reason = req.body.reason;
  let process = new processRequest(request);
  await process.archive(false, true, reason);
  res.status(200).send();
  process.removeFromDVR();
  let emails = [];
  let titles = [];
  await Promise.all(
    request.users.map(async (user) => {
      let userData = await User.findOne({ id: user });
      if (!userData) return;
      emails.push(userData.email);
      titles.push(userData.title);
    })
  );
  new Mailer().mail(
    `Your request was ${request.approved ? "removed" : "denied"} for ${
      request.title
    }`,
    `Your request was ${request.approved ? "removed" : "denied"} for ${
      request.title
    }`,
    `Unfortunately your request could not be processed.${
      reason ? ` This is because - ${reason}.` : ""
    } Thanks for your request anyway!`,
    `https://image.tmdb.org/t/p/w500${request.thumb}`,
    emails,
    titles
  );
});

router.post("/update", async (req, res) => {
  let request = req.body.request;
  let servers = req.body.servers;
  let approved = req.body.request.approved;
  let manualStatus = req.body.request.manualStatus;
  if (manualStatus === "5") {
    new processRequest(request, false).archive(true, false, false);
    res.status(200).send();
    return;
  }
  try {
    await Request.findOneAndUpdate(
      { requestId: request.requestId },
      {
        $set: {
          approved: true,
          manualStatus: manualStatus,
        },
      },
      { new: true, useFindAndModify: false }
    );
    if (servers && request.type === "movie") {
      await Promise.all(
        Object.keys(servers).map(async (r) => {
          let active = servers[r].active;
          if (active) {
            await new Radarr(
              r,
              false,
              servers[r].profile,
              servers[r].path
            ).processRequest(request.requestId);
          }
        })
      );
    }
    if (servers && request.type === "tv") {
      await Promise.all(
        Object.keys(servers).map(async (s) => {
          let active = servers[s].active;
          request.id = request.requestId;
          if (active) {
            await new Sonarr().addShow({ id: s }, request, {
              profile: servers[s].profile,
              path: servers[s].path,
            });
          }
        })
      );
    }
    res.status(200).send();
    if (!approved) {
      let emails = [];
      let titles = [];
      await Promise.all(
        request.users.map(async (user) => {
          let userData = await User.findOne({ id: user });
          if (!userData) return;
          emails.push(userData.email);
          titles.push(userData.title);
        })
      );
      const requestData = request;
      let type = requestData.type === "tv" ? "TV Show" : "Movie";
      new Mailer().mail(
        `Request approved for ${requestData.title}`,
        `${type}: ${requestData.title}`,
        `Your request has been reviewed and has been approved. You'll receive an email once it has been added to Plex!`,
        `https://image.tmdb.org/t/p/w500${requestData.thumb}`,
        emails,
        titles
      );
    }
  } catch (err) {
    logger.log("error", `ROUTE: Error updating requests`);
    logger.log({ level: "error", message: err });
    res.status(500).send();
  }
});

router.get("/archive/:id", async (req, res) => {
  const id = req.params.id;
  const archive = await getArchive(id);
  res.json(archive);
});

module.exports = router;
