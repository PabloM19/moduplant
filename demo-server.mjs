import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { createCatalogue, isCatalogueRoute } from './catalogue.mjs';

const stateDirectory = new URL('./.local/', import.meta.url);
const stateFile = new URL('edits.json', stateDirectory);

export function localCatalogue() {
  function configure(server) {
    const session = randomUUID();
    const changes = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
    const {route} = createCatalogue({
      source: name => readFileSync(new URL(`./directory/${name}`, import.meta.url), 'utf8'),
      changes,
      saveChange(slug, change) {
        const next = {...changes};
        if (change) next[slug] = change;
        else delete next[slug];
        mkdirSync(stateDirectory, {recursive: true});
        const temp = new URL('edits.tmp', stateDirectory);
        writeFileSync(temp, JSON.stringify(next, null, 2), {mode: 0o600});
        renameSync(temp, stateFile);
      },
      mode: {
        isAdmin: req => (req.headers.get('cookie') ?? '').split(/;\s*/).includes(`moduplant_admin=${session}`),
        setAdmin: isAdmin => ({
          'Set-Cookie': `moduplant_admin=${isAdmin ? session : ''}; Path=/; HttpOnly; SameSite=Strict${isAdmin ? '' : '; Max-Age=0'}`,
        }),
      },
    });

    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, 'http://' + req.headers.host);
      if (!isCatalogueRoute(url.pathname)) return next();
      try {
        const read = req.method === 'GET' || req.method === 'HEAD';
        const request = new Request(url, {
          method: req.method,
          headers: req.headers,
          ...(read ? {} : {body: Readable.toWeb(req), duplex: 'half'}),
        });
        const result = await route(request);
        if (!result) return next();
        res.writeHead(result.status, Object.fromEntries(result.headers));
        res.end(req.method === 'HEAD' ? undefined : Buffer.from(await result.arrayBuffer()));
      } catch (error) {
        console.error(error);
        if (!res.headersSent) res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify({error: 'No se pudo completar la operación local.'}));
      }
    });
  }
  return {name: 'moduplant-local-catalogue', configureServer: configure, configurePreviewServer: configure};
}
