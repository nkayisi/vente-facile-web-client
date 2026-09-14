# Socle commun : pnpm est le SEUL gestionnaire de ce projet (le lockfile qui
# fait foi est pnpm-lock.yaml). Ne pas revenir a npm install : la dependance
# `@vente-facile/core` est declaree en `github:...#v0.7.x`, et npm resout ce
# tag en lancant `git ls-remote` : or `git` est ABSENT de node:20-alpine, d'ou
# `npm error syscall spawn git / errno -2` au build. pnpm, lui, lit le tarball
# codeload epingle dans pnpm-lock.yaml : du HTTPS, aucun binaire git requis.
FROM node:20-alpine AS base

# Node 20 tente IPv6 et IPv4 en parallele (RFC 8305, « Happy Eyeballs »). Sur
# certains reseaux Docker la selection RESTE BLOQUEE au lieu de basculer, et
# toute requete vers registry.npmjs.org expire. Le drapeau vaut aussi au
# demarrage : les server actions appellent le backend sur ce meme reseau.
# Il DOIT preceder le premier acces au registre, `npm install -g pnpm`
# compris : pose apres, l'installation de pnpm expire avant d'en profiter.
ENV NODE_OPTIONS=--no-network-family-autoselection

# pnpm installe par npm et NON par corepack : corepack leve
# ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING avec Node 20.20+ (meme contournement
# que le service `frontend` du docker-compose.yml de la racine).
RUN npm install -g pnpm@10

WORKDIR /app

# Etape dependances, isolee pour que le cache de couches ne soit invalide que
# par package.json / pnpm-lock.yaml, pas par une modification de code.
# pnpm-workspace.yaml est REQUIS : il porte `ignoredBuiltDependencies`
# (sharp, unrs-resolver), que pnpm 10 lit pour ne pas construire ces paquets.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Etape build. NODE_ENV n'est PAS pose ici : a `production`, pnpm sauterait les
# devDependencies et `next build` n'aurait ni typescript ni tailwind.
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN pnpm build

# Etape production
FROM base
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3001
CMD ["pnpm", "start"]
