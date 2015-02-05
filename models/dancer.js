"use strict";

var Sequelize = require("sequelize");

module.exports = function(sequelize, DataTypes) {
  var Dancer = sequelize.define("Dancer", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      dates: { type: Sequelize.STRING, allowNull: false },
      url: { type: Sequelize.STRING, allowNull: false },
      photoUrl: { type: Sequelize.STRING, allowNull: false },
      fullResolutionPhotoUrl: { type: Sequelize.STRING, allowNull: true },
      startDate: { type: Sequelize.DATE, allowNull: true },
      endDate: { type: Sequelize.DATE, allowNull: true }
  });

  return Dancer;
};