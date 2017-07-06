FROM mhart/alpine-node:6.9.2

RUN apk add --no-cache make gcc g++ python git bash
COPY package.json /src/package.json
WORKDIR /src
RUN npm install

ADD . .

EXPOSE 8545

ENTRYPOINT ["node", "./build/cli.node.js"]
