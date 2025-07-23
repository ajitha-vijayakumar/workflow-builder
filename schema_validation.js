const Ajv2020 = require("ajv/dist/2020");
const ajv = new Ajv2020({
  strict: true,
  allErrors: true,
});
const addFormats = require("ajv-formats");
const addKeyWords = require("ajv-keywords");

addFormats(ajv);
addKeyWords(ajv);

ajv.addKeyword({
  keyword: "isValidPath",
  type: "object",
  schemaType: "boolean",
  validate: function (schema, pathObj) {
    if (schema !== true) return true; // ignore if not enabled

    let hasStart = false;
    let hasEnd = false;

    for (const key in pathObj) {
      const val = pathObj[key];
      if (val && typeof val === 'object') {
        if (val.start === true && val.end === true) return true;
        if (val.start === true) hasStart = true;
        if (val.end === true) hasEnd = true;
      }
    }

    return hasStart && hasEnd;
  },
  errors: false
});

const schema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "minProperties": 2,
  "maxProperties": 50,
  "description": "schema of graph conf",
  "required": [
    "Start",
    "End"
  ],
  "$defs": {
    "NodeSchemas": {
      "type": "object",
      "oneOf": [
        {
          "$ref": "#/$defs/NormalNode"
        },
        {
          "$ref": "#/$defs/ConditionNode"
        },
        {
          "$ref": "#/$defs/SwitchNode"
        },
        {
          "$ref": "#/$defs/ParallelNode"
        },
        {
          "$ref": "#/$defs/SuccessNode"
        },
        {
          "$ref": "#/$defs/FailureNode"
        }
      ]
    },
    "NormalNode": {
      "type": "object",
      "description": "schema of a normal node",
      "properties": {
        "type": {
          "const": "node",
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "next": {
          "type": "string"
        },
        "payload": {
          "type": "object"
        }
      },
      "required": [
        "type",
        "id",
        "next"
      ]
    },
    "ConditionNode": {
      "type": "object",
      "description": "schema of a condition node",
      "properties": {
        "type": {
          "const": "condition",
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "next": {
          "type": "string"
        },
        "payload": {
          "type": "object"
        },
        "result": {
          "type": "object",
          "properties": {
            "trueNext": {
              "type": "string"
            },
            "falseNext": {
              "type": "string"
            }
          },
          "required": [
            "trueNext",
            "falseNext"
          ]
        }
      },
      "required": [
        "type",
        "id",
        "next",
        "result"
      ]
    },
    "SwitchNode": {
      "type": "object",
      "description": "schema of a switch node",
      "properties": {
        "type": {
          "const": "switch",
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "next": {
          "type": "string"
        },
        "payload": {
          "type": "object"
        },
        "cases": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "case": {
                "type": "string"
              },
              "next": {
                "type": "string"
              }
            },
            "required": [
              "case",
              "next"
            ]
          }
        }
      },
      "required": [
        "type",
        "id",
        "next",
        "cases"
      ]
    },
    "ParallelNode": {
      "type": "object",
      "description": "schema of a parallel node",
      "properties": {
        "type": {
          "const": "parallel",
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "next": {
          "type": "string"
        },
        "payload": {
          "type": "object"
        },
        "startNode": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "const" : "node"
            },
            "id": {
              "type": "string"
            },
            "payload": {
              "type": "object"
            }
          },
          "required": [
            "type",
            "id",
            "payload"
          ]
        },
        "paths": {
            "type": "array",
            "items": {
                "type": "object",
                "minProperties": 1,
                "isValidPath": true
            }
        }
      },
      "required": [
        "type",
        "id",
        "next",
        "startNode",
        "paths"
      ]
    },
    "SuccessNode": {
      "type": "object",
      "description": "schema of a success node",
      "properties": {
        "type": {
          "const": "success",
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "next": {
          "type": "null"
        },
        "payload": {
          "type": "object"
        }
      },
      "required": [
        "type",
        "id"
      ]
    },
    "FailureNode": {
      "type": "object",
      "description": "schema of a failure node",
      "properties": {
        "type": {
          "const": "failure",
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "next": {
          "type": "null"
        },
        "payload": {
          "type": "object"
        }
      },
      "required": [
        "type",
        "id"
      ]
    }
  },
  "properties": {
    "Start": {
      "type": "object",
      "properties": {
        "type": {
          "const": "node",
          "type":"string"
        },
        "next": {
          "type": "string"
        },
        "id": {
          "const": "Start",
          "type":"string"
        },
        "payload": {
          "type": "object"
        }
      },
      "required": [
        "type",
        "next",
        "id",
        "payload"
      ]
    },
    "End": {
      "type": "object",
      "properties": {
        "type": {
          "const": "node",
          "type":"string"
        },
        "next": {
          "type": "null"
        },
        "id": {
          "const": "End",
          "type":"string"
        },
        "payload": {
          "type": "object"
        }
      },
      "required": [
        "type",
        "id",
        "payload"
      ]
    }
  },
  "additionalProperties": {
    "$ref": "#/$defs/NodeSchemas"
  }
};

let data = {
        "Start": {
            type: "node",
            next: "Parallel One",
            id: "Start",
            payload: {}
        },
        "Parallel One": {
                type: "parallel",
                id: "Parallel One",
                startNode: {
                    type: "node",
                    id: "Par 1 Start",
                    payload: {}
                },
                paths: [
                    {
                        "Par 2 End": {
                            type: "node",
                            next: null,
                            start : true,
                            end: true,
                            id: "Par 2 End",
                        },
                    }, {
                        "P2": {
                            type: "node",
                            next: "P2a",
                            start: true,
                            id: "P2",
                        },
                        "P2a": {
                            type: "node",
                            next: null,
                            end: true,
                            id: "P2a",
                        },
                    }
                ],
                next: "Par 1 End"
        },
        "Par 1 End": {
            type: "node",
            next: "Condition One",
            id: "End",
        },
        "End": {
            type: "node",
            next: null,
            payload : {},
            id: "End",
        }
        };
// Compile and validate
const validate = ajv.compile(schema);
const valid = validate(data);

if (valid) {
  console.log("Valid");
} else {
  console.log("Validation errors:", validate.errors);
}
