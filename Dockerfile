FROM mhart/alpine-node:8

RUN apk add --no-cache make gcc g++ python git bash
COPY package.json /src/package.json
WORKDIR /src
ADD . .
RUN npm install

EXPOSE 8545

ENTRYPOINT ["node", "./build/cli.node.js"]
