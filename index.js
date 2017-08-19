const earcut = require("./earcut");
const fs = require('fs');

function parseTemplate(data,template){
  var content = template;

  for(var prop in data) if(data.hasOwnProperty(prop)){


    content = content.split('['+prop+']').join(data[prop]);
  }

  return content;
}

module.exports = function rubeToCollada(rubePath,colladaPath,filter = true){
  var rubeJson  = fs.readFileSync(rubePath).toString();
  var rubeJsonData = JSON.parse(rubeJson);
  var roundFloat = 1000000;
  var circleSegment = 32;


  var geometryTemplate = fs.readFileSync(__dirname+"/templates/geometry.dae").toString();
  var objectTemplate = fs.readFileSync(__dirname+"/templates/object.dae").toString();
  var sceneTemplate = fs.readFileSync(__dirname+"/templates/scene.dae").toString();


  var bodiesGeom = [];
  var bodiesObj = [];

  var bodyNamesIndex = {};

  for(var body of rubeJsonData.body){

    if(filter) {
      if (body.hasOwnProperty("customProperties")) {
        var customProps = body.customProperties;

        var enabled = false;

        for (var prop of customProps) {
          if (prop.name === "exportMesh" && prop.bool === true){
            enabled = true;
            break;
          }
        }

        if(!enabled)
          continue;

      }else continue;

    }



    var pos = body.position;

    var vertInd = 0;
    var finalVertices = [];
    var normalsVertices = [];
    var finalTriangles = [];
    var trianglesCountStrides = [];


    var nameSuffix = "";

    if(bodyNamesIndex.hasOwnProperty(body.name)){
      nameSuffix = "-"+bodyNamesIndex[body.name];

      bodyNamesIndex[body.name]++;

    }else{
      bodyNamesIndex[body.name] = 1;
    }



    var bodyName = body.name + nameSuffix;

    for(var fixture of body.fixture){


      if(fixture.polygon){
        var vertices = new Array(fixture.polygon.vertices.x.length * 2);




        for(let i = 0 ; i < fixture.polygon.vertices.x.length ; i++){

          var x = Math.round(fixture.polygon.vertices.x[i] * roundFloat) / roundFloat;
          var y = Math.round(fixture.polygon.vertices.y[i] * roundFloat) / roundFloat;

          vertices[i*2] = x ;
          vertices[i*2+1] = y;

          finalVertices.push(x,y,0);

          normalsVertices.push(0,0,1);

        }


        // console.log('fixture.polygon : ', fixture.polygon,vertices);

        var triangles = earcut(vertices);



        for(let i = 0 ; i < triangles.length ; i++){
          var ind = triangles[i] + vertInd;
          finalTriangles.push(ind,ind);

          if(i%3 === 0)
            trianglesCountStrides.push(3);

        }

        vertInd += fixture.polygon.vertices.x.length;



      }else if(fixture.circle){

        var circlePos =  fixture.circle.center ? fixture.circle.center : {x:0,y:0};
        var radius    =  fixture.circle.radius;


        normalsVertices.push(0,0,1);
        finalVertices.push(circlePos.x,circlePos.y,0);

        var i0 = 0;

        for(var i=0;i<circleSegment;i++){

          normalsVertices.push(0,0,1);

          var angle = Math.PI * 2 / circleSegment * i;


          finalVertices.push(
              Math.round(circlePos.x + Math.cos(angle) * radius * roundFloat) / roundFloat,
              Math.round(circlePos.y + Math.sin(angle) * radius * roundFloat) / roundFloat,
              0
          );

          var i1 = i+1;
          var i2 = i1 < circleSegment ? i1 + 1 : 1;

          finalTriangles.push(
              i0+vertInd,
              i0+vertInd,
              i1+vertInd,
              i1+vertInd,
              i2+vertInd,
              i2+vertInd
          );

          trianglesCountStrides.push(3);

        }




        vertInd += circleSegment + 1;

      }





    }


    var geometryData = {
      name:bodyName,

      position_vertices:finalVertices.join(' '),
      position_vertices_count:finalVertices.length,
      position_vertices_prop_count:finalVertices.length/3,

      normal_vertices:normalsVertices.join(' '),
      normal_vertices_count:normalsVertices.length,
      normal_vertices_prop_count:normalsVertices.length/3,

      triangles_count:finalTriangles.length / 3,
      triangles_count_strides:trianglesCountStrides.join(" "),
      triangles:finalTriangles.join(' ')
    };


    var objectData = {
      name:bodyName,
      matrix:'1 0 0 '+pos.x+' 0 1 0 '+pos.y+' 0 0 1 0 0 0 0 1',
    };


    var geomDae = parseTemplate(geometryData,geometryTemplate);
    var objDae = parseTemplate(objectData,objectTemplate);



    bodiesGeom.push(geomDae);
    bodiesObj.push(objDae);

    //console.log(finalVertices,finalTriangles,normalsVertices);

  }

  if(bodiesGeom.length === 0)
    return false;


  var finalDae = parseTemplate({
    geometries:bodiesGeom.join("\n"),
    objects:bodiesObj.join("\n"),
  },sceneTemplate);


  console.log('saved collada: ', colladaPath.split("/").pop()+" : "+bodiesGeom.length+" objects");


  fs.writeFileSync(colladaPath,finalDae);


};