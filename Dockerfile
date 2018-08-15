FROM mhart/alpine-node:8 as builder

RUN apk add --no-cache make gcc g++ python git bash
COPY package.json /src/package.json
COPY package-lock.json /src/package-lock.json
WORKDIR /src
RUN npm install
ADD . .
RUN npm run build

FROM mhart/alpine-node:8 as runtime

WORKDIR /app
COPY --from=builder "/src/build/cli.node.js" "./cli.node.js"
COPY --from=builder "/src/build/cli.node.js.map" "./cli.node.js.map"

ENV DOCKER true

EXPOSE 8545

ENTRYPOINT ["node", "/app/cli.node.js"]
