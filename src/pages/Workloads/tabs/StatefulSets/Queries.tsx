import { SceneQueryRunner, SceneVariableSet, SceneVariables } from "@grafana/scenes";
import { Metrics } from "metrics/metrics";
import { resolveVariable } from "common/variableHelpers";
import { TableRow } from "./types";
import { Labels, MatchOperators, PromQL, PromQLExpression } from "common/promql";
import { ColumnSortingConfig, QueryBuilder } from "components/AsyncTable";
import { SortingState } from "common/sortingHelpers";

export function createReplicasQuery(cluster: string, additionalLabels: Labels) {

    return PromQL.max(
        PromQL.metric(Metrics.kubeStatefulsetStatusReplicas.name)
            .withLabels(additionalLabels)
            .withLabelEquals('cluster', cluster)
    ).by([
        Metrics.kubeStatefulsetStatusReplicas.labels.statefulset,
        Metrics.kubeStatefulsetStatusReplicas.labels.namespace,
    ])
}

export function createReplicasReadyQuery(cluster: string, additionalLabels: Labels) {
    
    return PromQL.max(
        PromQL.metric(Metrics.kubeStatefulsetStatusReplicasReady.name)
            .withLabels(additionalLabels)
            .withLabelEquals('cluster', cluster)
    ).by([
        Metrics.kubeStatefulsetStatusReplicasReady.labels.statefulset,
        Metrics.kubeStatefulsetStatusReplicas.labels.namespace,
    ])
}

function createAlertsQuery(cluster: string, additionalLabels: Labels) {

    return PromQL.metric('ALERTS')
        .withLabelEquals('alertstate', 'firing')
        .withLabels(additionalLabels)
        .withLabelEquals('cluster', cluster)
        .multiply()
        .ignoring(['alertstate'])
        .groupRight(
            ['alertstate'],
            PromQL.metric('ALERTS_FOR_STATE')
                .withLabels(additionalLabels)
                .withLabelEquals('cluster', cluster)
        )
}

export class StatefulSetQueryBuilder implements QueryBuilder<TableRow> {
    rootQueryBuilder(variables: SceneVariables | SceneVariableSet, sorting: SortingState, sortingConfig?: ColumnSortingConfig<TableRow>) {

        const baseQuery = PromQL.group(
            PromQL.metric(Metrics.kubeStatefulSetCreated.name)
                .withLabelEquals('cluster', '$cluster')
                .withLabelMatches(Metrics.kubeStatefulSetCreated.labels.namespace, '$namespace')
                .withLabelMatches(Metrics.kubeStatefulSetCreated.labels.statefulset, '.*$search.*')
        ).by([
            Metrics.kubeStatefulSetCreated.labels.statefulset,
            Metrics.kubeStatefulSetCreated.labels.namespace
        ]);

        const remoteSort = sortingConfig && sortingConfig.local === false

        let finalQuery: PromQLExpression = baseQuery;
        if (remoteSort) {
            switch (sorting.columnId) {
                case 'alerts':
                    finalQuery = PromQL.sort(
                        sorting.direction,
                        baseQuery
                            .multiply()
                            .on(['namespace', 'statefulset'])
                            .groupRight(
                                [],
                                PromQL.count(
                                    createAlertsQuery('$cluster', {
                                        'statefulset': {
                                            operator: MatchOperators.NOT_EQUALS,
                                            value: ''
                                        }
                                    })
                                ).by(['namespace', 'statefulset'])
                            )
                            .or()
                            .withExpression(
                                baseQuery.multiply().withScalar(0)
                            )
                        )
                    break;
                case 'replicas':
                    finalQuery = PromQL.sort(
                        sorting.direction,
                        baseQuery
                            .multiply()
                            .on(['namespace', 'statefulset'])
                            .groupRight(
                                [],
                                createReplicasQuery('$cluster', {})
                            )
                            .or()
                            .withExpression(
                                baseQuery.multiply().withScalar(0)
                            )
                        )
                    break;
            }
        }

        return new SceneQueryRunner({
            datasource: {
                uid: '$datasource',
                type: 'prometheus',
            },
            queries: [
                {
                    refId: 'statefulsets',
                    expr: finalQuery.stringify(),
                    instant: true,
                    format: 'table'
                },
            ], 
        })
    }

    rowQueryBuilder(rows: TableRow[], variables: SceneVariableSet | SceneVariables) {
        const statefulSets = rows.map(row => row.statefulset).join('|');
        const cluster = resolveVariable(variables, 'cluster');

        const additionalLabels = {
            statefulset: {
                operator: MatchOperators.MATCHES,
                value: statefulSets
            }
        }

        return [
            {
                refId: 'replicas',
                expr: createReplicasQuery(cluster?.toString()!, additionalLabels).stringify(),
                instant: true,
                format: 'table'
            },
            {
                refId: 'replicas_ready',
                expr: createReplicasReadyQuery(cluster?.toString()!, additionalLabels).stringify(),
                instant: true,
                format: 'table'
            },
            {
                refId: 'alerts',
                expr: createAlertsQuery(cluster?.toString()!, additionalLabels).stringify(),
                instant: true,
                format: 'table'
            }
        ];
    }
}
