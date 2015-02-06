module.exports = {
    port: process.env.PORT,
    host: process.env.IP,
    mongoUrl : 'mongodb://{0}/mayordomo'.format(process.env.IP)
}