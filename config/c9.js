module.exports = {
    port: process.env.PORT,
    host: process.env.IP,
    publicHost: 'https://mayordomo-eadl.c9.io',
    mongoUrl : 'mongodb://{0}/mayordomo'.format(process.env.IP),
    enableCors: false,
    stockWatchList: 'MUTF:RAFGX|30.47,MUTF:PRRSX|8.14'
}