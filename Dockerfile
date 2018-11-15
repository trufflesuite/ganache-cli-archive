FROM mhart/alpine-node:10 as builder

RUN apk add --no-cache make gcc g++ python git bash
COPY package.json /app/package.json
COPY npm-shrinkwrap.json /app/npm-shrinkwrap.json
WORKDIR /app
RUN npm install
COPY . .
RUN npm run build

FROM mhart/alpine-node:10 as runtime

WORKDIR /app

COPY --from=builder "/app/node_modules/ganache-core/node_modules/scrypt/build/Release" "./node_modules/ganache-core/node_modules/scrypt/build/Release/"
COPY --from=builder "/app/node_modules/ganache-core/node_modules/secp256k1/build/Release" "./node_modules/ganache-core/node_modules/secp256k1/build/Release/"
COPY --from=builder "/app/node_modules/ganache-core/node_modules/keccak/build/Release" "./node_modules/ganache-core/node_modules/keccak/build/Release/"
COPY --from=builder "/app/node_modules/ganache-core/node_modules/sha3/build/Release" "./node_modules/ganache-core/node_modules/sha3/build/Release/"
COPY --from=builder "/app/node_modules/ganache-core/node_modules/websocket/build/Release" "./node_modules/ganache-core/node_modules/websocket/build/Release/"
COPY --from=builder "/app/docker/build/ganache.core.cli.js" "./ganache.core.cli.js"
COPY --from=builder "/app/docker/build/ganache.core.cli.js.map" "./ganache.core.cli.js.map"

ENV DOCKER true

EXPOSE 8545

ENTRYPOINT ["node", "/app/ganache.core.cli.js"]
