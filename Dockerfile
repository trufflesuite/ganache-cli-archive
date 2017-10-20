FROM mhart/alpine-node:latest

RUN apk add --no-cache make gcc g++ python git bash
COPY package.json /src/package.json
WORKDIR /src
RUN npm install

ADD . .

EXPOSE 8545

ENTRYPOINT ["node", "./build/cli.node.js"]
