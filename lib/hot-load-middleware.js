/* jshint node: true */
/* global require, module */
"use strict";
var fs = require("fs");

function getModuleName(item) {
  if (typeof item !== "string") {
    return "unable-to-get-module-name";
  }
  return item
    .split("[")[0]
    .replace("(", "")
    .replace(",", "")
    .split("'")
    .join("")
    .trim();
}

function extractFileDataToResult(data, queryFile, queryComponents) {
  const definer = "define(";
  const exports = data.split(definer);
  const originalFile = exports.join(definer);
  const components = queryComponents.split(",").filter(name => name);
  const result = {
    file: queryFile,
    components: components,
    items: exports
      .map(item => {
        return {
          file: definer + item,
          name: getModuleName(item)
        };
      })
      .filter(item => {
        let hasComponent = false;
        components.forEach(componentName => {
          if (item.name.includes(componentName)) {
            hasComponent = true;
          }
        });
        return hasComponent;
      }),
    splitter: definer
  };
  return {
    result,
    originalFile
  };
}

function generateFileFromArray(items) {
  return "'use strict';" + items.map(item => item.file).join("");
}


function onFileRequested(req, res) {
  var appFileName = req.params.name.split('---').join('/');
  if (!appFileName.endsWith('.js')) {
    return res.status(404).send('Not found');
  }
  const filePath = "dist/assets/" + appFileName;
  const vendorPath = "dist/assets/vendor.js";
  const queryFile = req.query.file;
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Not found');
  }
  fs.readFile(filePath, "utf8", function (
    err,
    data
  ) {
    if (err) throw err;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");

    if (!req.query.components || !req.query.components.length) {
      res.send(data);
      return;
    }
    
    var processedResult = extractFileDataToResult(data, queryFile, req.query.components);
    var appItems = processedResult.result.items || [];
    var appFile = processedResult.originalFile;

    if (!fs.existsSync(vendorPath)) {
      // if we can't find vendor file -> return only app lookups.
      if (appItems.length) {
        res.send(generateFileFromArray(appItems));
      } else {
        res.send(appFile);
      }
      return;
    } else {
      fs.readFile(vendorPath, "utf8", function (
        errs,
        vendorData
      ) {
        if (errs) {
          if (appItems.length) {
            res.send(generateFileFromArray(appItems));
          } else {
            res.send(appFile);
          }
          return;
        }

        var processedVendorResult = extractFileDataToResult(vendorData, queryFile, req.query.components);
        var vendorItems = processedVendorResult.result.items || [];
        // var vendorFile = processedVendorResult.originalFile;

        if (appItems.length && vendorItems.length) {
          res.send(generateFileFromArray([].concat(appItems, vendorItems)));
        } else if (!appItems.length && vendorItems.length) {
          res.send(generateFileFromArray(vendorItems));
        } else if (!vendorItems.length && appItems.length) {
          res.send(generateFileFromArray(appItems));
        } else {
          res.send(appFile);
        }

      });
    }
    // const resultOutput = exports
  });
}


module.exports = function HotReloader(config/*, options = {}*/) {

  return {
    run: function () {
      config.app.get("/_hot-load/:name", onFileRequested);
    }
  };

};
