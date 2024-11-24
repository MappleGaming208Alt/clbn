import express from "express";
import http from "node:http";
import cors from "cors";
import path from "node:path";
import { hostname } from "node:os";
import chalk from "chalk";
import routes from "./src/routes.js";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import {
  createRammerhead,
  shouldRouteRh,
  routeRhUpgrade,
  routeRhRequest,
} from "./src/RH/index.js";

const server = http.createServer();
const app = express();
const __dirname = process.cwd();

const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public/static/")));
app.use(cors());
app.use("/epoxy/", express.static(epoxyPath));
app.use("/@/", express.static(uvPath));
app.use("/libcurl/", express.static(libcurlPath));
app.use("/baremux/", express.static(baremuxPath));

const rh = createRammerhead({
  logLevel: 'info',
  reverseProxy: false,
  disableLocalStorageSync: false,
  disableHttp2: false,
})

app.use("/", routes);

wisp.options.dns_servers = ["1.1.1.3", "1.0.0.3"];

server.on("request", (req, res) => {
  if (shouldRouteRh(req)) {
    routeRhRequest(
      rh,
      req,
      res
    );
  } else {
    app(req, res);
  }
});

server.on("upgrade", (req, socket, head) => {
  if (req.url.endsWith("/wisp/")) {
    wisp.routeRequest(req, socket, head);
    console.log("Wisp upgrade request:" + req);
  } else if (shouldRouteRh(req)) {
    routeRhUpgrade(
      rh,
      req,
      socket,
      head
    );
  }
});

server.on("listening", () => {
  const address = server.address();
  const theme = chalk.hex("#8F00FF");
  const host = chalk.hex("0d52bd");
  console.log(
    chalk.bold(
      theme(`
        
██████╗  █████╗ ██╗   ██╗██████╗ ██████╗ ███████╗ █████╗ ███╗   ███╗    ██╗  ██╗
██╔══██╗██╔══██╗╚██╗ ██╔╝██╔══██╗██╔══██╗██╔════╝██╔══██╗████╗ ████║    ╚██╗██╔╝
██║  ██║███████║ ╚████╔╝ ██║  ██║██████╔╝█████╗  ███████║██╔████╔██║     ╚███╔╝ 
██║  ██║██╔══██║  ╚██╔╝  ██║  ██║██╔══██╗██╔══╝  ██╔══██║██║╚██╔╝██║     ██╔██╗ 
██████╔╝██║  ██║   ██║   ██████╔╝██║  ██║███████╗██║  ██║██║ ╚═╝ ██║    ██╔╝ ██╗
╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝    ╚═╝  ╚═╝
                                                                                
`)
    )
  );
  console.log(
    `  ${chalk.bold(host("Local System:"))}            http://${address.family === "IPv6" ? `[${address.address}]` : address.address}${address.port === 80 ? "" : ":" + chalk.bold(address.port)}`
  );

  console.log(
    `  ${chalk.bold(host("Local System:"))}            http://localhost${address.port === 8080 ? "" : ":" + chalk.bold(address.port)}`
  );

  try {
    console.log(
      `  ${chalk.bold(host("On Your Network:"))}  http://${hostname()}${address.port === 8080 ? "" : ":" + chalk.bold(address.port)}`
    );
  } catch (err) {
    // can't find LAN interface
  }

  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    console.log(
      `  ${chalk.bold(host("Replit:"))}           https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    );
  }

  if (process.env.HOSTNAME && process.env.GITPOD_WORKSPACE_CLUSTER_HOST) {
    console.log(
      `  ${chalk.bold(host("Gitpod:"))}           https://${PORT}-${process.env.HOSTNAME}.${process.env.GITPOD_WORKSPACE_CLUSTER_HOST}`
    );
  }

  if (
    process.env.CODESPACE_NAME &&
    process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
  ) {
    console.log(
      `  ${chalk.bold(host("Github Codespaces:"))}           https://${process.env.CODESPACE_NAME}-${address.port === 80 ? "" : address.port}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    );
  }
});

server.listen({ port: PORT });

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.setMaxListeners(0);

function shutdown() {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
}
