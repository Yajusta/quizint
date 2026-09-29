# Protocole temps réel (Socket.IO)

> Généré automatiquement depuis les schémas Zod de `@quiz/shared` — `pnpm docs:protocol`.

Deux namespaces : `/presenter` (cookie JWT admin) et `/participant` (token de participant ou join).

Toute commande client → serveur reçoit un ack `{ ok: true, ...data } | { ok: false, code, message }`.
Chaque événement serveur porte `serverTime` (epoch ms) pour la synchronisation d'horloge.

## Événements serveur → clients

### `state:snapshot` — participant

Full participant snapshot sent on every (re)connection

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "sessionId": {
      "type": "string"
    },
    "code": {
      "type": "string"
    },
    "quizTitle": {
      "type": "string"
    },
    "phase": {
      "type": "string",
      "enum": [
        "LOBBY",
        "QUESTION_OPEN",
        "QUESTION_CLOSED",
        "FINAL_RANKING",
        "ENDED"
      ]
    },
    "questionIndex": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "totalQuestions": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "you": {
      "type": "object",
      "properties": {
        "participantId": {
          "type": "string"
        },
        "nickname": {
          "type": "string"
        },
        "score": {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        "rank": {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        }
      },
      "required": [
        "participantId",
        "nickname",
        "score",
        "rank"
      ],
      "additionalProperties": false
    },
    "participantCount": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "question": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "view": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                },
                "position": {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991
                },
                "type": {
                  "type": "string",
                  "enum": [
                    "MCQ",
                    "TRUE_FALSE",
                    "NUMERIC",
                    "POLL",
                    "TEXT_POLL"
                  ]
                },
                "prompt": {
                  "type": "string"
                },
                "media": {
                  "anyOf": [
                    {
                      "anyOf": [
                        {
                          "type": "object",
                          "properties": {
                            "kind": {
                              "type": "string",
                              "enum": [
                                "IMAGE",
                                "AUDIO"
                              ]
                            },
                            "url": {
                              "type": "string"
                            },
                            "width": {
                              "default": null,
                              "anyOf": [
                                {
                                  "type": "integer",
                                  "minimum": -9007199254740991,
                                  "maximum": 9007199254740991
                                },
                                {
                                  "type": "null"
                                }
                              ]
                            },
                            "height": {
                              "default": null,
                              "anyOf": [
                                {
                                  "type": "integer",
                                  "minimum": -9007199254740991,
                                  "maximum": 9007199254740991
                                },
                                {
                                  "type": "null"
                                }
                              ]
                            },
                            "durationSec": {
                              "default": null,
                              "type": [
                                "number",
                                "null"
                              ]
                            }
                          },
                          "required": [
                            "kind",
                            "url",
                            "width",
                            "height",
                            "durationSec"
                          ],
                          "additionalProperties": false
                        },
                        {
                          "type": "object",
                          "properties": {
                            "kind": {
                              "type": "string",
                              "enum": [
                                "IMAGE",
                                "AUDIO"
                              ]
                            },
                            "hidden": {
                              "type": "boolean",
                              "const": true
                            }
                          },
                          "required": [
                            "kind",
                            "hidden"
                          ],
                          "additionalProperties": false
                        }
                      ]
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "mediaOnParticipants": {
                  "type": "boolean"
                },
                "pointsCorrect": {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991
                },
                "pointsWrong": {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991
                },
                "timeLimitSec": {
                  "anyOf": [
                    {
                      "type": "integer",
                      "minimum": -9007199254740991,
                      "maximum": 9007199254740991
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "speedBonusMax": {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991
                },
                "choices": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                      },
                      "position": {
                        "type": "integer",
                        "minimum": -9007199254740991,
                        "maximum": 9007199254740991
                      },
                      "label": {
                        "type": "string"
                      },
                      "media": {
                        "anyOf": [
                          {
                            "type": "object",
                            "properties": {
                              "kind": {
                                "type": "string",
                                "enum": [
                                  "IMAGE",
                                  "AUDIO"
                                ]
                              },
                              "url": {
                                "type": "string"
                              },
                              "width": {
                                "default": null,
                                "anyOf": [
                                  {
                                    "type": "integer",
                                    "minimum": -9007199254740991,
                                    "maximum": 9007199254740991
                                  },
                                  {
                                    "type": "null"
                                  }
                                ]
                              },
                              "height": {
                                "default": null,
                                "anyOf": [
                                  {
                                    "type": "integer",
                                    "minimum": -9007199254740991,
                                    "maximum": 9007199254740991
                                  },
                                  {
                                    "type": "null"
                                  }
                                ]
                              },
                              "durationSec": {
                                "default": null,
                                "type": [
                                  "number",
                                  "null"
                                ]
                              }
                            },
                            "required": [
                              "kind",
                              "url",
                              "width",
                              "height",
                              "durationSec"
                            ],
                            "additionalProperties": false
                          },
                          {
                            "type": "null"
                          }
                        ]
                      }
                    },
                    "required": [
                      "id",
                      "position",
                      "label",
                      "media"
                    ],
                    "additionalProperties": false
                  }
                }
              },
              "required": [
                "id",
                "position",
                "type",
                "prompt",
                "media",
                "mediaOnParticipants",
                "pointsCorrect",
                "pointsWrong",
                "timeLimitSec",
                "speedBonusMax",
                "choices"
              ],
              "additionalProperties": false
            },
            "openedAt": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "closesAt": {
              "anyOf": [
                {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991
                },
                {
                  "type": "null"
                }
              ]
            },
            "alreadyAnswered": {
              "type": "boolean"
            },
            "yourAnswer": {
              "anyOf": [
                {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "choiceId": {
                          "type": "string",
                          "format": "uuid",
                          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                        }
                      },
                      "required": [
                        "choiceId"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "value": {
                          "type": "number"
                        }
                      },
                      "required": [
                        "value"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "text": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "text"
                      ],
                      "additionalProperties": false
                    }
                  ]
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "required": [
            "view",
            "openedAt",
            "closesAt",
            "alreadyAnswered",
            "yourAnswer"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "roundResult": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "questionIndex": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "correctAnswer": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "choiceId": {
                      "type": "string",
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                    },
                    "label": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "choiceId",
                    "label"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "value": {
                      "type": "number"
                    },
                    "tolerance": {
                      "type": "number"
                    },
                    "toleranceMode": {
                      "type": "string",
                      "enum": [
                        "ABSOLUTE",
                        "PERCENT"
                      ]
                    }
                  },
                  "required": [
                    "value",
                    "tolerance",
                    "toleranceMode"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "yourAnswer": {
              "anyOf": [
                {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "choiceId": {
                          "type": "string",
                          "format": "uuid",
                          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                        }
                      },
                      "required": [
                        "choiceId"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "value": {
                          "type": "number"
                        }
                      },
                      "required": [
                        "value"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "text": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "text"
                      ],
                      "additionalProperties": false
                    }
                  ]
                },
                {
                  "type": "null"
                }
              ]
            },
            "isCorrect": {
              "type": [
                "boolean",
                "null"
              ]
            },
            "pointsBase": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "pointsBonus": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "pointsAwarded": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "totalScore": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "rank": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "participantCount": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "textEntries": {
              "anyOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "text": {
                        "type": "string"
                      },
                      "count": {
                        "type": "integer",
                        "minimum": -9007199254740991,
                        "maximum": 9007199254740991
                      }
                    },
                    "required": [
                      "text",
                      "count"
                    ],
                    "additionalProperties": false
                  }
                },
                {
                  "type": "null"
                }
              ]
            },
            "explanation": {
              "type": [
                "string",
                "null"
              ]
            }
          },
          "required": [
            "questionIndex",
            "correctAnswer",
            "yourAnswer",
            "isCorrect",
            "pointsBase",
            "pointsBonus",
            "pointsAwarded",
            "totalScore",
            "rank",
            "participantCount",
            "textEntries",
            "explanation"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "final": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "yourRank": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "yourScore": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "podium": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "rank": {
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991
                  },
                  "nickname": {
                    "type": "string"
                  },
                  "score": {
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991
                  }
                },
                "required": [
                  "rank",
                  "nickname",
                  "score"
                ],
                "additionalProperties": false
              }
            },
            "participantCount": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            }
          },
          "required": [
            "yourRank",
            "yourScore",
            "podium",
            "participantCount"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "serverTime": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "sessionId",
    "code",
    "quizTitle",
    "phase",
    "questionIndex",
    "totalQuestions",
    "you",
    "participantCount",
    "question",
    "roundResult",
    "final",
    "serverTime"
  ],
  "additionalProperties": false
}
```

### `state:snapshot` — presenter

Full presenter snapshot sent on every (re)connection

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "sessionId": {
      "type": "string"
    },
    "code": {
      "type": "string"
    },
    "joinUrl": {
      "type": "string"
    },
    "quizTitle": {
      "type": "string"
    },
    "phase": {
      "type": "string",
      "enum": [
        "LOBBY",
        "QUESTION_OPEN",
        "QUESTION_CLOSED",
        "FINAL_RANKING",
        "ENDED"
      ]
    },
    "questionIndex": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "totalQuestions": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "settings": {
      "type": "object",
      "properties": {
        "showIntermediateRanking": {
          "default": true,
          "type": "boolean"
        },
        "showParticipantAnswers": {
          "default": false,
          "type": "boolean"
        }
      },
      "required": [
        "showIntermediateRanking",
        "showParticipantAnswers"
      ],
      "additionalProperties": false
    },
    "participants": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "nickname": {
            "type": "string"
          },
          "connected": {
            "type": "boolean"
          },
          "score": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "isKicked": {
            "type": "boolean"
          },
          "joinedAt": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          }
        },
        "required": [
          "id",
          "nickname",
          "connected",
          "score",
          "isKicked",
          "joinedAt"
        ],
        "additionalProperties": false
      }
    },
    "question": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "view": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                },
                "position": {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991
                },
                "type": {
                  "type": "string",
                  "enum": [
                    "MCQ",
                    "TRUE_FALSE",
                    "NUMERIC",
                    "POLL",
                    "TEXT_POLL"
                  ]
                },
                "prompt": {
                  "type": "string"
                },
                "explanation": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "media": {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "kind": {
                          "type": "string",
                          "enum": [
                            "IMAGE",
                            "AUDIO"
                          ]
                        },
                        "url": {
                          "type": "string"
                        },
                        "width": {
                          "default": null,
                          "anyOf": [
                            {
                              "type": "integer",
                              "minimum": -9007199254740991,
                              "maximum": 9007199254740991
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "height": {
                          "default": null,
                          "anyOf": [
                            {
                              "type": "integer",
                              "minimum": -9007199254740991,
                              "maximum": 9007199254740991
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "durationSec": {
                          "default": null,
                          "type": [
                            "number",
                            "null"
                          ]
                        }
                      },
                      "required": [
                        "kind",
                        "url",
                        "width",
                        "height",
                        "durationSec"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "mediaOnParticipants": {
                  "type": "boolean"
                },
                "pointsCorrect": {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991
                },
                "pointsWrong": {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991
                },
                "timeLimitSec": {
                  "anyOf": [
                    {
                      "type": "integer",
                      "minimum": -9007199254740991,
                      "maximum": 9007199254740991
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "speedBonusMax": {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991
                },
                "choices": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "format": "uuid",
                        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                      },
                      "position": {
                        "type": "integer",
                        "minimum": -9007199254740991,
                        "maximum": 9007199254740991
                      },
                      "label": {
                        "type": "string"
                      },
                      "media": {
                        "anyOf": [
                          {
                            "type": "object",
                            "properties": {
                              "kind": {
                                "type": "string",
                                "enum": [
                                  "IMAGE",
                                  "AUDIO"
                                ]
                              },
                              "url": {
                                "type": "string"
                              },
                              "width": {
                                "default": null,
                                "anyOf": [
                                  {
                                    "type": "integer",
                                    "minimum": -9007199254740991,
                                    "maximum": 9007199254740991
                                  },
                                  {
                                    "type": "null"
                                  }
                                ]
                              },
                              "height": {
                                "default": null,
                                "anyOf": [
                                  {
                                    "type": "integer",
                                    "minimum": -9007199254740991,
                                    "maximum": 9007199254740991
                                  },
                                  {
                                    "type": "null"
                                  }
                                ]
                              },
                              "durationSec": {
                                "default": null,
                                "type": [
                                  "number",
                                  "null"
                                ]
                              }
                            },
                            "required": [
                              "kind",
                              "url",
                              "width",
                              "height",
                              "durationSec"
                            ],
                            "additionalProperties": false
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "isCorrect": {
                        "type": "boolean"
                      }
                    },
                    "required": [
                      "id",
                      "position",
                      "label",
                      "media",
                      "isCorrect"
                    ],
                    "additionalProperties": false
                  }
                },
                "numericAnswer": {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "value": {
                          "type": "number"
                        },
                        "tolerance": {
                          "default": 0,
                          "type": "number",
                          "minimum": 0
                        },
                        "toleranceMode": {
                          "default": "ABSOLUTE",
                          "type": "string",
                          "enum": [
                            "ABSOLUTE",
                            "PERCENT"
                          ]
                        }
                      },
                      "required": [
                        "value",
                        "tolerance",
                        "toleranceMode"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "id",
                "position",
                "type",
                "prompt",
                "explanation",
                "media",
                "mediaOnParticipants",
                "pointsCorrect",
                "pointsWrong",
                "timeLimitSec",
                "speedBonusMax",
                "choices",
                "numericAnswer"
              ],
              "additionalProperties": false
            },
            "openedAt": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "closesAt": {
              "anyOf": [
                {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991
                },
                {
                  "type": "null"
                }
              ]
            },
            "answered": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "answeredIds": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "connected": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            }
          },
          "required": [
            "view",
            "openedAt",
            "closesAt",
            "answered",
            "answeredIds",
            "connected"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "roundResult": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "questionIndex": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "correctAnswer": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "choiceId": {
                      "type": "string",
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                    },
                    "label": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "choiceId",
                    "label"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "value": {
                      "type": "number"
                    },
                    "tolerance": {
                      "type": "number"
                    },
                    "toleranceMode": {
                      "type": "string",
                      "enum": [
                        "ABSOLUTE",
                        "PERCENT"
                      ]
                    }
                  },
                  "required": [
                    "value",
                    "tolerance",
                    "toleranceMode"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "answersCount": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "correctCount": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "distribution": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "kind": {
                      "type": "string",
                      "const": "CHOICES"
                    },
                    "entries": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "choiceId": {
                            "type": "string",
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                          },
                          "label": {
                            "type": "string"
                          },
                          "count": {
                            "type": "integer",
                            "minimum": -9007199254740991,
                            "maximum": 9007199254740991
                          }
                        },
                        "required": [
                          "choiceId",
                          "label",
                          "count"
                        ],
                        "additionalProperties": false
                      }
                    }
                  },
                  "required": [
                    "kind",
                    "entries"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "kind": {
                      "type": "string",
                      "const": "NUMERIC"
                    },
                    "buckets": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "from": {
                            "type": "number"
                          },
                          "to": {
                            "type": "number"
                          },
                          "count": {
                            "type": "integer",
                            "minimum": -9007199254740991,
                            "maximum": 9007199254740991
                          }
                        },
                        "required": [
                          "from",
                          "to",
                          "count"
                        ],
                        "additionalProperties": false
                      }
                    },
                    "median": {
                      "type": [
                        "number",
                        "null"
                      ]
                    },
                    "expected": {
                      "type": "number"
                    },
                    "correctCount": {
                      "type": "integer",
                      "minimum": -9007199254740991,
                      "maximum": 9007199254740991
                    }
                  },
                  "required": [
                    "kind",
                    "buckets",
                    "median",
                    "expected",
                    "correctCount"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "kind": {
                      "type": "string",
                      "const": "TEXT"
                    },
                    "entries": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "text": {
                            "type": "string"
                          },
                          "count": {
                            "type": "integer",
                            "minimum": -9007199254740991,
                            "maximum": 9007199254740991
                          }
                        },
                        "required": [
                          "text",
                          "count"
                        ],
                        "additionalProperties": false
                      }
                    }
                  },
                  "required": [
                    "kind",
                    "entries"
                  ],
                  "additionalProperties": false
                }
              ]
            },
            "answers": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "participantId": {
                    "type": "string"
                  },
                  "nickname": {
                    "type": "string"
                  },
                  "payload": {
                    "anyOf": [
                      {
                        "type": "object",
                        "properties": {
                          "choiceId": {
                            "type": "string",
                            "format": "uuid",
                            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                          }
                        },
                        "required": [
                          "choiceId"
                        ],
                        "additionalProperties": false
                      },
                      {
                        "type": "object",
                        "properties": {
                          "value": {
                            "type": "number"
                          }
                        },
                        "required": [
                          "value"
                        ],
                        "additionalProperties": false
                      },
                      {
                        "type": "object",
                        "properties": {
                          "text": {
                            "type": "string"
                          }
                        },
                        "required": [
                          "text"
                        ],
                        "additionalProperties": false
                      }
                    ]
                  },
                  "isCorrect": {
                    "type": [
                      "boolean",
                      "null"
                    ]
                  },
                  "pointsBase": {
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991
                  },
                  "pointsBonus": {
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991
                  },
                  "pointsAwarded": {
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991
                  },
                  "elapsedMs": {
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991
                  }
                },
                "required": [
                  "participantId",
                  "nickname",
                  "payload",
                  "isCorrect",
                  "pointsBase",
                  "pointsBonus",
                  "pointsAwarded",
                  "elapsedMs"
                ],
                "additionalProperties": false
              }
            },
            "fastestCorrect": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "participantId": {
                      "type": "string"
                    },
                    "nickname": {
                      "type": "string"
                    },
                    "elapsedMs": {
                      "type": "integer",
                      "minimum": -9007199254740991,
                      "maximum": 9007199254740991
                    }
                  },
                  "required": [
                    "participantId",
                    "nickname",
                    "elapsedMs"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "top5": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "participantId": {
                    "type": "string"
                  },
                  "nickname": {
                    "type": "string"
                  },
                  "score": {
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991
                  },
                  "rank": {
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991
                  }
                },
                "required": [
                  "participantId",
                  "nickname",
                  "score",
                  "rank"
                ],
                "additionalProperties": false
              }
            },
            "previousRanks": {
              "type": "object",
              "propertyNames": {
                "type": "string"
              },
              "additionalProperties": {
                "type": "integer",
                "minimum": -9007199254740991,
                "maximum": 9007199254740991
              }
            },
            "explanation": {
              "type": [
                "string",
                "null"
              ]
            }
          },
          "required": [
            "questionIndex",
            "correctAnswer",
            "answersCount",
            "correctCount",
            "distribution",
            "answers",
            "fastestCorrect",
            "top5",
            "previousRanks",
            "explanation"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "final": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "podium": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "rank": {
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991
                  },
                  "nickname": {
                    "type": "string"
                  },
                  "score": {
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991
                  }
                },
                "required": [
                  "rank",
                  "nickname",
                  "score"
                ],
                "additionalProperties": false
              }
            },
            "ranking": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "participantId": {
                    "type": "string"
                  },
                  "nickname": {
                    "type": "string"
                  },
                  "score": {
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991
                  },
                  "rank": {
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991
                  }
                },
                "required": [
                  "participantId",
                  "nickname",
                  "score",
                  "rank"
                ],
                "additionalProperties": false
              }
            },
            "stats": {
              "type": "object",
              "properties": {
                "bestQuestion": {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "questionIndex": {
                          "type": "integer",
                          "minimum": -9007199254740991,
                          "maximum": 9007199254740991
                        },
                        "prompt": {
                          "type": "string"
                        },
                        "ratio": {
                          "type": "number"
                        }
                      },
                      "required": [
                        "questionIndex",
                        "prompt",
                        "ratio"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "worstQuestion": {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "questionIndex": {
                          "type": "integer",
                          "minimum": -9007199254740991,
                          "maximum": 9007199254740991
                        },
                        "prompt": {
                          "type": "string"
                        },
                        "ratio": {
                          "type": "number"
                        }
                      },
                      "required": [
                        "questionIndex",
                        "prompt",
                        "ratio"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "averageParticipationRate": {
                  "type": "number"
                },
                "averageScore": {
                  "type": "number"
                },
                "fastestCorrect": {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "participantId": {
                          "type": "string"
                        },
                        "nickname": {
                          "type": "string"
                        },
                        "elapsedMs": {
                          "type": "integer",
                          "minimum": -9007199254740991,
                          "maximum": 9007199254740991
                        },
                        "questionIndex": {
                          "type": "integer",
                          "minimum": -9007199254740991,
                          "maximum": 9007199254740991
                        }
                      },
                      "required": [
                        "participantId",
                        "nickname",
                        "elapsedMs",
                        "questionIndex"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "activeParticipants": {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991
                },
                "totalParticipants": {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991
                }
              },
              "required": [
                "bestQuestion",
                "worstQuestion",
                "averageParticipationRate",
                "averageScore",
                "fastestCorrect",
                "activeParticipants",
                "totalParticipants"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "podium",
            "ranking",
            "stats"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "serverTime": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "sessionId",
    "code",
    "joinUrl",
    "quizTitle",
    "phase",
    "questionIndex",
    "totalQuestions",
    "settings",
    "participants",
    "question",
    "roundResult",
    "final",
    "serverTime"
  ],
  "additionalProperties": false
}
```

### `session:phase`

On every phase transition

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "phase": {
      "type": "string",
      "enum": [
        "LOBBY",
        "QUESTION_OPEN",
        "QUESTION_CLOSED",
        "FINAL_RANKING",
        "ENDED"
      ]
    },
    "questionIndex": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "serverTime": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "phase",
    "questionIndex",
    "serverTime"
  ],
  "additionalProperties": false
}
```

### `question:open`

On question opening (view depends on audience)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "view": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "position": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "type": {
              "type": "string",
              "enum": [
                "MCQ",
                "TRUE_FALSE",
                "NUMERIC",
                "POLL",
                "TEXT_POLL"
              ]
            },
            "prompt": {
              "type": "string"
            },
            "explanation": {
              "type": [
                "string",
                "null"
              ]
            },
            "media": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "kind": {
                      "type": "string",
                      "enum": [
                        "IMAGE",
                        "AUDIO"
                      ]
                    },
                    "url": {
                      "type": "string"
                    },
                    "width": {
                      "default": null,
                      "anyOf": [
                        {
                          "type": "integer",
                          "minimum": -9007199254740991,
                          "maximum": 9007199254740991
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "height": {
                      "default": null,
                      "anyOf": [
                        {
                          "type": "integer",
                          "minimum": -9007199254740991,
                          "maximum": 9007199254740991
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "durationSec": {
                      "default": null,
                      "type": [
                        "number",
                        "null"
                      ]
                    }
                  },
                  "required": [
                    "kind",
                    "url",
                    "width",
                    "height",
                    "durationSec"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "mediaOnParticipants": {
              "type": "boolean"
            },
            "pointsCorrect": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "pointsWrong": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "timeLimitSec": {
              "anyOf": [
                {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991
                },
                {
                  "type": "null"
                }
              ]
            },
            "speedBonusMax": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "choices": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                  },
                  "position": {
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991
                  },
                  "label": {
                    "type": "string"
                  },
                  "media": {
                    "anyOf": [
                      {
                        "type": "object",
                        "properties": {
                          "kind": {
                            "type": "string",
                            "enum": [
                              "IMAGE",
                              "AUDIO"
                            ]
                          },
                          "url": {
                            "type": "string"
                          },
                          "width": {
                            "default": null,
                            "anyOf": [
                              {
                                "type": "integer",
                                "minimum": -9007199254740991,
                                "maximum": 9007199254740991
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "height": {
                            "default": null,
                            "anyOf": [
                              {
                                "type": "integer",
                                "minimum": -9007199254740991,
                                "maximum": 9007199254740991
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "durationSec": {
                            "default": null,
                            "type": [
                              "number",
                              "null"
                            ]
                          }
                        },
                        "required": [
                          "kind",
                          "url",
                          "width",
                          "height",
                          "durationSec"
                        ],
                        "additionalProperties": false
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "isCorrect": {
                    "type": "boolean"
                  }
                },
                "required": [
                  "id",
                  "position",
                  "label",
                  "media",
                  "isCorrect"
                ],
                "additionalProperties": false
              }
            },
            "numericAnswer": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "value": {
                      "type": "number"
                    },
                    "tolerance": {
                      "default": 0,
                      "type": "number",
                      "minimum": 0
                    },
                    "toleranceMode": {
                      "default": "ABSOLUTE",
                      "type": "string",
                      "enum": [
                        "ABSOLUTE",
                        "PERCENT"
                      ]
                    }
                  },
                  "required": [
                    "value",
                    "tolerance",
                    "toleranceMode"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "required": [
            "id",
            "position",
            "type",
            "prompt",
            "explanation",
            "media",
            "mediaOnParticipants",
            "pointsCorrect",
            "pointsWrong",
            "timeLimitSec",
            "speedBonusMax",
            "choices",
            "numericAnswer"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "position": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "type": {
              "type": "string",
              "enum": [
                "MCQ",
                "TRUE_FALSE",
                "NUMERIC",
                "POLL",
                "TEXT_POLL"
              ]
            },
            "prompt": {
              "type": "string"
            },
            "media": {
              "anyOf": [
                {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "kind": {
                          "type": "string",
                          "enum": [
                            "IMAGE",
                            "AUDIO"
                          ]
                        },
                        "url": {
                          "type": "string"
                        },
                        "width": {
                          "default": null,
                          "anyOf": [
                            {
                              "type": "integer",
                              "minimum": -9007199254740991,
                              "maximum": 9007199254740991
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "height": {
                          "default": null,
                          "anyOf": [
                            {
                              "type": "integer",
                              "minimum": -9007199254740991,
                              "maximum": 9007199254740991
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "durationSec": {
                          "default": null,
                          "type": [
                            "number",
                            "null"
                          ]
                        }
                      },
                      "required": [
                        "kind",
                        "url",
                        "width",
                        "height",
                        "durationSec"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "kind": {
                          "type": "string",
                          "enum": [
                            "IMAGE",
                            "AUDIO"
                          ]
                        },
                        "hidden": {
                          "type": "boolean",
                          "const": true
                        }
                      },
                      "required": [
                        "kind",
                        "hidden"
                      ],
                      "additionalProperties": false
                    }
                  ]
                },
                {
                  "type": "null"
                }
              ]
            },
            "mediaOnParticipants": {
              "type": "boolean"
            },
            "pointsCorrect": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "pointsWrong": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "timeLimitSec": {
              "anyOf": [
                {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991
                },
                {
                  "type": "null"
                }
              ]
            },
            "speedBonusMax": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "choices": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "format": "uuid",
                    "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                  },
                  "position": {
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991
                  },
                  "label": {
                    "type": "string"
                  },
                  "media": {
                    "anyOf": [
                      {
                        "type": "object",
                        "properties": {
                          "kind": {
                            "type": "string",
                            "enum": [
                              "IMAGE",
                              "AUDIO"
                            ]
                          },
                          "url": {
                            "type": "string"
                          },
                          "width": {
                            "default": null,
                            "anyOf": [
                              {
                                "type": "integer",
                                "minimum": -9007199254740991,
                                "maximum": 9007199254740991
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "height": {
                            "default": null,
                            "anyOf": [
                              {
                                "type": "integer",
                                "minimum": -9007199254740991,
                                "maximum": 9007199254740991
                              },
                              {
                                "type": "null"
                              }
                            ]
                          },
                          "durationSec": {
                            "default": null,
                            "type": [
                              "number",
                              "null"
                            ]
                          }
                        },
                        "required": [
                          "kind",
                          "url",
                          "width",
                          "height",
                          "durationSec"
                        ],
                        "additionalProperties": false
                      },
                      {
                        "type": "null"
                      }
                    ]
                  }
                },
                "required": [
                  "id",
                  "position",
                  "label",
                  "media"
                ],
                "additionalProperties": false
              }
            }
          },
          "required": [
            "id",
            "position",
            "type",
            "prompt",
            "media",
            "mediaOnParticipants",
            "pointsCorrect",
            "pointsWrong",
            "timeLimitSec",
            "speedBonusMax",
            "choices"
          ],
          "additionalProperties": false
        }
      ]
    },
    "questionIndex": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "totalQuestions": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "openedAt": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "closesAt": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        {
          "type": "null"
        }
      ]
    },
    "serverTime": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "view",
    "questionIndex",
    "totalQuestions",
    "openedAt",
    "closesAt",
    "serverTime"
  ],
  "additionalProperties": false
}
```

### `participants:list`

Presenter only — debounced 200 ms, every change, all phases

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "participants": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "nickname": {
            "type": "string"
          },
          "connected": {
            "type": "boolean"
          },
          "score": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "isKicked": {
            "type": "boolean"
          },
          "joinedAt": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          }
        },
        "required": [
          "id",
          "nickname",
          "connected",
          "score",
          "isKicked",
          "joinedAt"
        ],
        "additionalProperties": false
      }
    },
    "count": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "participants",
    "count"
  ],
  "additionalProperties": false
}
```

### `answers:progress`

Presenter only — throttled 250 ms per answer

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "questionIndex": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "answered": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "connected": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "total": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "recent": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "answeredIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "questionIndex",
    "answered",
    "connected",
    "total",
    "recent",
    "answeredIds"
  ],
  "additionalProperties": false
}
```

### `settings:changed`

After settings:update

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "showIntermediateRanking": {
      "default": true,
      "type": "boolean"
    },
    "showParticipantAnswers": {
      "default": false,
      "type": "boolean"
    }
  },
  "required": [
    "showIntermediateRanking",
    "showParticipantAnswers"
  ],
  "additionalProperties": false
}
```

### `lobby:count`

Participant only — debounced 500 ms, LOBBY phase

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "count": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "count"
  ],
  "additionalProperties": false
}
```

### `participant:kicked`

Participant only — on kick

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "message": {
      "type": "string"
    }
  },
  "required": [
    "message"
  ],
  "additionalProperties": false
}
```

## Commandes clients → serveur

### `participant:join`

Participant namespace — join with code + nickname

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "pattern": "^[A-Z0-9]{6}$"
    },
    "nickname": {
      "type": "string",
      "minLength": 2,
      "maxLength": 20
    }
  },
  "required": [
    "code",
    "nickname"
  ],
  "additionalProperties": false
}
```

### `answer:submit`

Participant namespace — submit an answer

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "questionIndex": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "answer": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "choiceId": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            }
          },
          "required": [
            "choiceId"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "value": {
              "type": "string",
              "minLength": 1,
              "maxLength": 32
            }
          },
          "required": [
            "value"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "text": {
              "type": "string",
              "minLength": 1,
              "maxLength": 160
            }
          },
          "required": [
            "text"
          ],
          "additionalProperties": false
        }
      ]
    }
  },
  "required": [
    "questionIndex",
    "answer"
  ],
  "additionalProperties": false
}
```

### `session:start`

Presenter namespace

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "force": {
      "type": "boolean"
    }
  },
  "additionalProperties": false
}
```

### `question:close`

Presenter namespace — idempotent via expectedIndex

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "expectedIndex": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "expectedIndex"
  ],
  "additionalProperties": false
}
```

### `question:next`

Presenter namespace — idempotent via expectedIndex

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "expectedIndex": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "expectedIndex"
  ],
  "additionalProperties": false
}
```

### `question:back`

Presenter namespace — QUESTION_OPEN (index ≥ 1) → previous QUESTION_CLOSED; discards the open question’s answers

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "expectedIndex": {
      "type": "integer",
      "minimum": 1,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "expectedIndex"
  ],
  "additionalProperties": false
}
```

### `question:reopen`

Presenter namespace — QUESTION_CLOSED → same QUESTION_OPEN, fresh timer; discards its answers and result

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "expectedIndex": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "expectedIndex"
  ],
  "additionalProperties": false
}
```

### `participant:kick`

Presenter namespace — any phase

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "participantId": {
      "type": "string"
    }
  },
  "required": [
    "participantId"
  ],
  "additionalProperties": false
}
```

### `settings:update`

Presenter namespace

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "showIntermediateRanking": {
      "type": "boolean"
    },
    "showParticipantAnswers": {
      "type": "boolean"
    }
  },
  "additionalProperties": false
}
```

## Fin de session

### `session:ended`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "reason": {
      "type": "string",
      "enum": [
        "ENDED",
        "CANCELLED"
      ]
    }
  },
  "required": [
    "reason"
  ],
  "additionalProperties": false
}
```
