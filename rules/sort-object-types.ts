import type { SortingNode } from '../typings'

import { AST_NODE_TYPES } from '@typescript-eslint/types'

import { createEslintRule } from '../utils/create-eslint-rule'
import { toSingleLine } from '../utils/to-single-line'
import { rangeToDiff } from '../utils/range-to-diff'
import { SortType, SortOrder } from '../typings'
import { sortNodes } from '../utils/sort-nodes'
import { makeFixes } from '../utils/make-fixes'
import { complete } from '../utils/complete'
import { pairwise } from '../utils/pairwise'
import { compare } from '../utils/compare'

type MESSAGE_ID = 'unexpectedObjectTypesOrder'

type Options = [
  Partial<{
    'ignore-case': boolean
    order: SortOrder
    type: SortType
  }>,
]

export const RULE_NAME = 'sort-object-types'

export default createEslintRule<Options, MESSAGE_ID>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'enforce sorted object types',
      recommended: false,
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          type: {
            enum: [
              SortType.alphabetical,
              SortType.natural,
              SortType['line-length'],
            ],
            default: SortType.natural,
          },
          order: {
            enum: [SortOrder.asc, SortOrder.desc],
            default: SortOrder.asc,
          },
          'ignore-case': {
            type: 'boolean',
            default: false,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unexpectedObjectTypesOrder:
        'Expected "{{second}}" to come before "{{first}}"',
    },
  },
  defaultOptions: [
    {
      type: SortType.alphabetical,
      order: SortOrder.asc,
    },
  ],
  create: context => ({
    TSTypeLiteral: node => {
      if (node.members.length > 1) {
        let options = complete(context.options.at(0), {
          type: SortType.alphabetical,
          'ignore-case': false,
          order: SortOrder.asc,
        })

        let source = context.getSourceCode()

        let nodes: SortingNode[] = node.members.map(member => {
          let name: string

          if (member.type === AST_NODE_TYPES.TSPropertySignature) {
            if (member.key.type === AST_NODE_TYPES.Identifier) {
              ;({ name } = member.key)
            } else if (member.key.type === AST_NODE_TYPES.Literal) {
              name = `${member.key.value}`
            } else {
              name = source.text.slice(
                member.range.at(0),
                member.typeAnnotation?.range.at(0),
              )
            }
          } else if (member.type === AST_NODE_TYPES.TSIndexSignature) {
            let endIndex: number =
              member.typeAnnotation?.range.at(0) ?? member.range.at(1)!

            name = source.text.slice(member.range.at(0), endIndex)
          } else {
            name = source.text.slice(member.range.at(0), member.range.at(1))
          }

          return {
            size: rangeToDiff(member.range),
            node: member,
            name,
          }
        })

        pairwise(nodes, (first, second) => {
          if (compare(first, second, options)) {
            context.report({
              messageId: 'unexpectedObjectTypesOrder',
              data: {
                first: toSingleLine(first.name),
                second: toSingleLine(second.name),
              },
              node: second.node,
              fix: fixer =>
                makeFixes(fixer, nodes, sortNodes(nodes, options), source),
            })
          }
        })
      }
    },
  }),
})