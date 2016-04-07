FROM mhart/alpine-node:5.10

WORKDIR /src
ADD . .

RUN apk add --no-cache make gcc g++ python git bash
RUN npm install

EXPOSE 8545

ENTRYPOINT ["node", "./bin/testrpc"]
