FROM mhart/alpine-node:6.9.2

WORKDIR /src
ADD . .

RUN apk add --no-cache make gcc g++ python git bash
RUN npm install

EXPOSE 8545

ENTRYPOINT ["node", "./bin/testrpc"]
