# Kiln v2 public testnet instructions

Kiln v2 public testnet has been bootstrapped. The config files can be downloaded from https://github.com/eth-clients/merge-testnets/tree/main/kiln

## Execution - EthereumJS Setup

Please ensure you have Node 12.x+ installed.

1. `git clone --depth 1 --branch master https://github.com/ethereumjs/ethereumjs-monorepo.git`
1. `cd ethereumjs-monorepo`
1. `npm i`
1. `cd packages/client`

### Download the config

1. `cd kiln`
2. `git init && git remote add -f origin https://github.com/eth-clients/merge-testnets.git && git config core.sparseCheckout true && echo "kiln/*" >> .git/info/sparse-checkout && git pull --depth=1 origin main && mv kiln config`

+This will download the config files to `kiln/config`.

### Run client

1. `npm run client:start -- --datadir kiln/datadir --gethGenesis kiln/config/genesis.json --saveReceipts --rpc --rpcport=8545 --ws --rpcEngine --rpcEnginePort=8551 --bootnodes=165.232.180.230:30303`

Starting the client will write a `kiln/datadir/jwtsecret` file with a randomly generated secret to be used in conjunction with a CL client. This secret will be used to authenticate the `engine_*` api requests (hosted at port `8551`) from the CL. In case you want to host `engine_*` without auth, pass `--rpcEngineAuth false` as extra argument in the above run command.

To prevent the secret to be re-generated next time you restart the client, pass the file as an argument to read from via `--jwt-secret=kiln/datadir/jwtsecret`.

##### Note

1. Other rpc apis, will be hosted openly without auth requirement at 8545.
2. Websocket endpoints will also be available at `8551` (for `engine_*`) and `8545` for the rest.

#### Docker

Or try it in Docker.

In `packages/client/kiln` run:

`docker-compose --file docker-compose.ethereumjs.yml up`

## Consensus

### Lodestar

#### Beacon

1. Use lodestar branch `master` and run `yarn && yarn build`
2. Export path of the downloaded config dir `export CONFIG_PATH=/path/to/ethereumjs-monorepo/packages/client/kiln/config`
3. Export path of the written jwt secret file `export JWT_SECRET_PATH=/path/to/ethereumjs-monorepo/packages/client/kiln/datadir/jwtsecret`
4. Run cmd: `./lodestar beacon --rootDir kiln/temp --paramsFile $CONFIG_PATH/config.yaml --genesisStateFile $CONFIG_PATH/genesis.ssz --bootnodesFile $CONFIG_PATH/boot_enr.yaml --network.connectToDiscv5Bootnodes --network.discv5.enabled true --eth1.enabled true --eth1.providerUrls=http://localhost:8545 --execution.urls=http://localhost:8551 --eth1.disableEth1DepositDataTracker true --jwt-secret $JWT_SECRET_PATH`

#### Validator

1. Run cmd: `./lodestar validator --rootDir=kiln/temp_validatordata --paramsFile=$CONFIG_PATH/config.yaml --keystoresDir=kiln/keystores --secretsDir=kiln/secrets`

Also, one will need to remove `--eth1.disableEth1DepositDataTracker true` and instead provide `--eth1.depositContractDeployBlock <block number>` in the previous beacon start command. The block number can be extracted from `kiln/config/deposit_contract_block.txt`

### Lighthouse

### Beacon

1. Use lighthouse branch `unstable` and run `make`
1. Make dir `lighthouse/kiln` and copy in from the downloaded config dir: `config.yaml`, `genesis.ssz`, `deploy_block.txt`, `deposit_contract.txt`, `deposit_contract_block.txt`
1. Run cmd: `lighthouse --debug-level=info --datadir=kiln/datadir --testnet-dir=kiln beacon_node --disable-enr-auto-update --dummy-eth1 --boot-nodes="enr:" --merge --http-allow-sync-stalled --metrics --disable-packet-filter --execution-endpoints=http://127.0.0.1:8551 --terminal-total-difficulty-override=`
