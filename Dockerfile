# --- build : vérifie (typecheck + tests), construit le client et compile le serveur en JS ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN npm ci
COPY . .
# Une erreur de syntaxe ou de type, ou un test qui échoue, fait échouer le build de l'image.
RUN npm run check
RUN npm run build

# --- image finale : node + deux fichiers statiques, aucune dépendance, utilisateur non-root ---
FROM node:22-alpine
ENV NODE_ENV=production PORT=8000 STATIC_DIR=/app/public
WORKDIR /app
COPY --from=build /app/apps/server/dist/index.cjs ./server.cjs
COPY --from=build /app/apps/client/dist ./public
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.cjs"]
