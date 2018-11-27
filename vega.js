looker.plugins.visualizations.add({
    create: function(element, config){

        container = element.appendChild(document.createElement("div"));
        container.setAttribute("id","my-table");

    },
    updateAsync: function(data, element, config, queryResponse, details, doneRendering){

      var myData = [];
      var dataProperties = {};
      var dims = [];
      var meas = [];
      var allFields = [];

      var options = createOptions(queryResponse)['options'];  

      this.trigger('registerOptions', options);  

      if (Object.keys(config).length > 2) {

      if (config['domain'] != "") {
        var colorDomain = [];
        for (num in config['domain'].split(",")) {
          colorDomain.push(Number(config['domain'].split(",")[num]));
        }       
      }

      var chartWidth = document.getElementById("my-table").offsetWidth * 0.81;
      var chartHeight = document.getElementById("my-table").offsetHeight;
      var parent = document.getElementById("my-table").parentElement;
      var chartHeight = parent.offsetHeight * 0.78;

      for (var cell in data) {
        var obj = data[cell];
        var dataDict = {};
        dataDict['links'] = [];
        for (var key in obj){
          var shortName = key.replace(".","?");
          dataDict[shortName] = obj[key]['value'];
          if (typeof obj[key]['links'] != "undefined") {

            //create array of all links for a row of data
            for(var l=0;l<obj[key]['links'].length;l++){

              //grab link label and add field name for clarity in menu
              var currentLabel = obj[key]['links'][l]['label'];
              currentLabel = currentLabel + " (" + shortName.substring(shortName.indexOf("?")+1) + ")";
              obj[key]['links'][l]['label'] = currentLabel;
            }
            //add links for field in row
            dataDict['links'].push(obj[key]['links']);
          }
        }
        //flatten to make single depth array
        dataDict['links'] = dataDict['links'].flat();
        myData.push(dataDict);
      }

      var rowValues = [];
      var colValues = [];

      //auto-size settings when a row facet included
      if (typeof config['row'] != "undefined" && typeof config['row'] != "" && config['fixed_height'] == null) {
        for (var x = 0; x < myData.length; x++) {
          rowValues.push(myData[x][config['row']]);
        }
        let uniqueRows = new Set(rowValues); 
        chartHeight = Math.max( (chartHeight / uniqueRows.size), (chartHeight / 12) );       
      }

      //auto-sizing settings when a column facet included
      if (typeof config['column'] != "undefined" && config['column'] != "" && config['fixed_width'] == null) {
        for (var x = 0; x < myData.length; x++) {
          colValues.push(myData[x][config['column']]);
        }
        let uniqueCols = new Set(colValues); 
        chartWidth = Math.max( (chartWidth / uniqueCols.size), (chartWidth / 12) ) ;       
      }

      //manual-sizing for chart height
      if (typeof config['fixed_height'] != "undefined" && config['fixed_height'] != null) {
        chartHeight = config['fixed_height'];
      }

      //manual-sizing for chart width
      if (typeof config['fixed_width'] != "undefined" && config['fixed_width'] != null) {
        chartWidth = config['fixed_width'];
      }      

      //create array of all measures for lookup purposes
      queryResponse.fields.measure_like.forEach(function(field){
        var fieldName = (field.name).replace(".","?");
        meas.push(fieldName);      
      });
      //create array of all dimensions for lookup purposes
      queryResponse.fields.dimension_like.forEach(function(field){
        var fieldName = (field.name).replace(".","?");
        dims.push(fieldName);      
      });

      allFields = meas.concat(dims);

      var dataFormatDict = {
        "$#,##0" : "$,.0f",
        "$#,##0.00" : "$,.2f",
        "#,##0.00%" : ",.2%",
        "#,##0.0%" : ",.1%",
        "#,##0%" : ",.0%",
        "null" : ""
      };

      //determine number format
      for (var field in allFields) {
        var lookerName = allFields[field].replace("?",".");
        dataProperties[allFields[field]] = {};
        //get friendly names for measures
        queryResponse.fields.measure_like.forEach(function(measure){
          if (lookerName == measure['name']) {
            //get label short or label to handle table calcs
            if (typeof measure['label_short'] != "undefined") {
              dataProperties[allFields[field]]['title'] = measure['label_short'];
            } else {
              dataProperties[allFields[field]]['title'] = measure['label'];
            }
            dataProperties[allFields[field]]['valueFormat'] = dataFormatDict[String(measure['value_format'])];
            dataProperties[allFields[field]]['dtype'] = "quantitative";
          } 
        });
        //get friendly names for dimensions
        queryResponse.fields.dimension_like.forEach(function(dimension){
          if (lookerName == dimension['name']) {
            if (typeof dimension['label_short'] != "undefined") {
              dataProperties[allFields[field]]['title'] = dimension['label_short'];
            } else {
              dataProperties[allFields[field]]['title'] = dimension['label'];
            }       
            dataProperties[allFields[field]]['valueFormat'] = dataFormatDict[String(dimension['value_format'])];
            dataProperties[allFields[field]]['dtype'] = "nominal";
          } 
        });
      }

      //construct the tooltip with appropriate formatting
      var tooltipFields = [];

      for (datum in dataProperties) {
        var tip = {};
        tip['field'] = datum;
        tip['type'] = dataProperties[datum]['dtype'];
        tip['format'] = dataProperties[datum]['valueFormat'];
        tip['title'] = dataProperties[datum]['title'];
        tooltipFields.push(tip);
      }


      //switch to compatible mark if trying to utilize shape
      if (config['shape'] != "") {
        config['mark_type'] = "point";
      }

      var chart = {
        "$schema": "https://vega.github.io/schema/vega-lite/v3.json",
        "data": {
          "values": myData
        },
        // "autosize": {
        //   "type": "fit",
        //   "contains": "padding"
        // },
        "config": {
          "mark": {
            "size": null,
            "color": null,
            "circle": null,
            "bar": {"size":null},
            "text": {"size":null},
            "tick": {"size":null},
            "point": {"size":2},
            "square": {"size":null}            
          }
        },
        "mark": {
          "type": config['mark_type'], 
          "fillOpacity": config['opacity'],
          "stroke": config['border']
          // "strokeWidth": 1
        },
        "width": chartWidth,
        "height": chartHeight,
        "encoding": {
          "tooltip" : tooltipFields      
        }
      };


      //checks for building viz based on config selections//
     //////////////////////////////////////////////////////

     //add points to line to ensure proper drill through
     var marksNeedingPoints = ["line","trail","area"];
     // "mark": {"type": "line", "color": "green", "point": {"color": "red"}},
     if (marksNeedingPoints.includes(config['mark_type'])) {
      chart.mark.point = {"color":config['fixed_color']};
     }

     if (config['y'] != "") {
      chart.encoding.y = {"field": config['y'], "type": dataProperties[config['y']]['dtype'], "title": dataProperties[config['y']]['title']};
     }

     if (config['x'] != "") {
      chart.encoding.x = {"field": config['x'], "type": dataProperties[config['x']]['dtype'], "title": dataProperties[config['x']]['title']};
     }

      //row & column facets
      if (config['column'] != "") {
        //add column facet
        chart.encoding.column = {"field":config['column'],"type":dataProperties[config['column']]['dtype'],"title": dataProperties[config['column']]['title']};
        // check for independent axes
        if (config['resolve_y'] != "" && config['y'] != "") {
          chart.resolve = {"scale": {"y":"independent"}};
        }
        if (config['resolve_x'] != "" && config['x'] != "") {
          chart.resolve = {"scale": {"x":"independent"}};
        }
      }      
      if (config['row'] != "") {
        //add row facet
        chart.encoding.row = {"field":config['row'],"type":dataProperties[config['row']]['dtype'],"title": dataProperties[config['row']]['title']};
        // check for independent axes
        if (config['resolve_y'] != "" && config['y'] != "") {
          chart.resolve = {"scale": {"y":"independent"}};
        }
        if (config['resolve_x'] != "" && config['x'] != "") {
          chart.resolve = {"scale": {"x":"independent"}};
        }        
      }

      //coloring properties

      //check when someone trying to use categorical scheme with sequential data
      var myColorPalettes = ["tableau10","tableau20","dark2","category20b","set2"];
      
      if (config['color'] != ""){
        //add color setting based on data type
        chart.encoding.color = {"field": config['color'], "type": dataProperties[config['color']]['dtype'],"title": dataProperties[config['color']]['title']};
        if (dataProperties[config['color']]['dtype'] == 'quantitative') {
          //determine scale and scheme based on data type
          if (config['color_scheme'] == "") {
            chart.encoding.color.scale = {"type": "sequential", "scheme":"blues"};
          } else {
            if (myColorPalettes.includes(config['color_scheme'])) {config['color_scheme'] = "blues";}
            chart.encoding.color.scale = {"type": "sequential", "scheme": {"name" : config['color_scheme']}, "domain" : colorDomain}; //"domain" : [-1,0,1]
          }
        } else if (dataProperties[config['color']]['dtype'] == 'nominal') {
          if (config['color_scheme'] == "") {
            chart.encoding.color.scale = {"type": "ordinal", "scheme":"tableau10"};
          } else {
            chart.encoding.color.scale = {"type": "ordinal", "scheme":config['color_scheme']};
          }
        }
      } else {
        if (config['mark_type'] == "line") {
          chart.mark.stroke = config['fixed_color'];
        } else {
          chart.mark.fill = config['fixed_color'];
        }
      }

      var sizableMarks = ["point", "square", "circle", "tick", "bar", "text"];

      //shape properties
      if (config['shape'] != "") {
        chart.encoding.shape = {"field": config['shape'], "type": dataProperties[config['shape']]['dtype'],"title": dataProperties[config['shape']]['title']};
      }

      //sizing properties
      if (config['size'] != "") {
        chart.encoding.size = {"field": config['size'], "type": dataProperties[config['size']]['dtype'],"title": dataProperties[config['size']]['title']};
      } else {
        chart.config.mark.size = config['fixed_size'];
      }


      // console.log(chart);

      vegaEmbed("#my-table", chart, {actions: false}).then(({spec, view}) => {
        view.addEventListener('click', function (event, item) {
          LookerCharts.Utils.openDrillMenu({
            links: item.datum.links,
            event: event
          });
        });
          doneRendering();
      });

}
      
    }
});

function createOptions(queryResponse){

  var masterList = [];
  var dimensionList = [];
  var measureList = [];
  var options = {};
  var defaultDim;
  var defaultMes;
  var optionsResponse = {};
  optionsResponse['options'] = {};
  optionsResponse['measures'] = [];
  optionsResponse['dimensions'] = [];
  optionsResponse['masterList'] = [];

  var dimCounter = 1;
  var mesCounter = 1;

  queryResponse.fields.dimension_like.forEach(function(field){
    var dimLib = {};
    var fieldName = (field.name).replace(".","?");
    if (typeof field.label_short != "undefined") {
      dimLib[field.label_short] = fieldName; //store friendly label & field name
    } else {
      dimLib[field.label] = fieldName; //capture label, mainly for table calcs
    }
    if (dimCounter == 1) {
      defaultDim = fieldName; //grab first dimension to use as default X value
    }
    optionsResponse['masterList'].push(dimLib); //add to master list of all fields
    optionsResponse['dimensions'].push(dimLib);
    dimCounter += 1;
  });

  queryResponse.fields.measure_like.forEach(function(field){
    var mesLib = {};
    var fieldName = (field.name).replace(".","?");
    if (typeof field.label_short != "undefined") {
      mesLib[field.label_short] = fieldName;
    } else {
      mesLib[field.label] = fieldName;
    }
    if (mesCounter == 1) {
      defaultMes = fieldName //grab first measure as default Y value
    }
    optionsResponse['masterList'].push(mesLib);
    optionsResponse['measures'].push(mesLib);
    mesCounter += 1;
  });

  var mesLib = {};
  mesLib['NA'] = "";
  optionsResponse['masterList'].push(mesLib);
  optionsResponse['measures'].push(mesLib);
  optionsResponse['dimensions'].push(mesLib);

  optionsResponse['options']['x'] = {
    label: "X",
    section: "1) Axes",
    type: "string",
    display: "select",
    order: 1,
    values: optionsResponse['masterList'],
    default: defaultDim
  }
  optionsResponse['options']['y'] = {
    label: "Y",
    section: "1) Axes",
    type: "string",
    display: "select",
    order: 2,
    values: optionsResponse['masterList'],
    default: defaultMes
  }
  optionsResponse['options']['size'] = {
    label: "Size",
    section: "2) Mark",
    type: "string",
    display: "select",
    order: 5,
    values: optionsResponse['measures'],
    default: ""
  }
  optionsResponse['options']['color'] = {
    label: "Color",
    section: "2) Mark",
    type: "string",
    display: "select",
    order: 2,
    values: optionsResponse['masterList'],
    default: ""
  }
  optionsResponse['options']['color_scheme'] = {
    label: "Color Scheme",
    section: "2) Mark",
    type: "string",
    display: "select",
    order: 3,
    values: [
      {"Auto" : ""},
      {"Default 10 (Categorical)" : "tableau10"},
      {"Default 20 (Categorical)" : "tableau20"},
      {"Dark 8 (Categorical)" : "dark2"},
      {"Dark 20 (Categorical)" : "category20b"},
      {"Light 8 (Categorical)" : "set2"},
      {"Blues (Sequential)" : "blues"},
      {"Greens (Sequential)" : "greens"},
      {"Grays (Sequential)" : "greys"},
      {"Purples (Sequential)" : "purples"},
      {"Oranges (Sequential)" : "oranges"},
      {"Viridis (Sequential Multi)" : "viridis"},
      {"Inferno (Sequential Multi)" : "inferno"},
      {"Magma (Sequential Multi)" : "magma"},
      {"Plasma (Sequential Multi)" : "plasma"},
      {"Blue Purple (Sequential Multi)" : "bluepurple"},
      {"Purple Red (Sequential Multi)" : "purplered"},
      {"Spectral (Diverging)" : "spectral"},
      {"Red Blue (Diverging)" : "redblue"},
      {"Red Gray (Diverging)" : "redgrey"},
      {"Red Green (Diverging)" : "redyellowgreen"},
      {"Brown Green (Diverging)" : "brownbluegreen"}
    ],
    default: ""
  }
  optionsResponse['options']['domain'] = {
    label: "Color Domain",
    section: "2) Mark",
    type: "string",
    display: "text",
    order: 4,
    default: ""
  }
  optionsResponse['options']['row'] = {
    label: "Row",
    section: "1) Axes",
    type: "string",
    order: 3,
    display: "select",
    default: "",
    values: optionsResponse['dimensions']
  }
  optionsResponse['options']['column'] = {
    label: "Column",
    section: "1) Axes",
    type: "string",
    order: 4,
    display: "select",
    default: "",
    values: optionsResponse['dimensions']
  }
  optionsResponse['options']['resolve_x'] = {
    label: "Independent X Axis",
    section: "1) Axes",
    type: "string",
    display: "select",
    default: "",
    order: 5,
    values: [
    {"Yes":"independent"},
    {"No":""}
    ]
  }
  optionsResponse['options']['resolve_y'] = {
    label: "Independent Y Axis",
    section: "1) Axes",
    type: "string",
    display: "select",
    order: 6,
    default: "",
    values: [
    {"Yes":"independent"},
    {"No":""}
    ]
  }
  optionsResponse['options']['fixed_size'] = {
    label: "Fixed Size",
    section: "3) Format",
    type: "number",
    display: "range",
    default: 100,
    min: 20,
    max: 5000
  }
  optionsResponse['options']['opacity'] = {
    label: "Opacity",
    section: "3) Format",
    type: "number",
    display: "text",
    default: 1,
    step: 1,
    min: 0,
    max: 1
  }
  optionsResponse['options']['fixed_height'] = {
    label: "Chart Height",
    section: "3) Format",
    type: "number",
    display: "text",
    default: null,
  }
  optionsResponse['options']['fixed_width'] = {
    label: "Chart Width",
    section: "3) Format",
    type: "number",
    display: "text",
    default: null,
  }
  optionsResponse['options']['fixed_color'] = {
    label: "Color",
    section: "3) Format",
    type: "string",
    display: "text",
    default: "#4C78A8"
  }
  optionsResponse['options']['border'] = {
    label: "Border (Enter color)",
    section: "3) Format",
    type: "string",
    display: "text",
    default: ""

  }
  optionsResponse['options']['shape'] = {
    label: "Shape",
    section: "2) Mark",
    order: 6,
    type: "string",
    display: "select",
    values: optionsResponse['dimensions'],
    default: ""
  }
  optionsResponse['options']['mark_type'] = {
    label: "Mark Type",
    section: "2) Mark",
    type: "string",
    order: 1,
    display: "select",
    default: "bar",
    values: [
      {"Bar" : "bar"},
      {"Rule" : "rule"},
      {"Circle" : "circle"},
      {"Tick" : "tick"},
      {"Text" : "text"},
      {"Line" : "line"},
      {"Rect" : "rect"},
      {"Area" : "area"},
      {"Point" : "point"},
      {"Trail" : "trail"}
    ]
  }

  return optionsResponse;
}



