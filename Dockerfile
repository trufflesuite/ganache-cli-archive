FROM mhart/alpine-node:8

RUN apk add --no-cache make gcc g++ python git bash
COPY package.json /src/package.json
COPY package-lock.json /src/package-lock.json
WORKDIR /src
RUN npm install
ADD . .
RUN npm run build

EXPOSE 8545

ENTRYPOINT ["node", "./build/cli.node.js"]
