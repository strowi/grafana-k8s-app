import { 
    EmbeddedScene,
    SceneFlexLayout, 
    SceneFlexItem, 
    SceneQueryRunner,
    TextBoxVariable,
    SceneVariableSet,
    VariableValueSelectors,
    SceneVariables,
} from '@grafana/scenes';
import { buildExpandedRowScene } from './ExpandedRow';
import { ReplicasCell } from 'pages/Workloads/components/ReplicasCell';
import { getSeriesValue } from 'common/seriesHelpers';
import { createNamespaceVariable } from 'common/variableHelpers';
import { createRowQueries } from './Queries';
import { Metrics } from 'metrics/metrics';
import { AsyncTable, Column, ColumnSortingConfig, QueryBuilder } from 'components/AsyncTable';
import { SortingState } from 'common/sortingHelpers';
import { ROUTES } from '../../../../constants';
import { prefixRoute } from 'utils/utils.routing';
import { TableRow } from "./types";

const namespaceVariable = createNamespaceVariable();

const searchVariable = new TextBoxVariable({
    name: 'search',
    label: 'Search',
    value: '',
});

const serieMatcherPredicate = (row: TableRow) => (value: any) => value.statefulset === row.statefulset;

function asyncDataRowMapper(row: TableRow, asyncRowData: Map<string, number[]>) {
    
    const total = getSeriesValue(asyncRowData, 'replicas', serieMatcherPredicate(row))
    const ready = getSeriesValue(asyncRowData, 'replicas_ready', serieMatcherPredicate(row))

    row.replicas = {
        total,
        ready
    }       
}

const columns: Array<Column<TableRow>> = [
    {
        id: 'statefulset',
        header: 'STATEFULSET',
        cellType: 'link',
        cellProps: {
            urlBuilder: (row: TableRow) => prefixRoute(`${ROUTES.Workloads}/statefulsets/${row.namespace}/${row.statefulset}`),
        },
        sortingConfig: {
            enabled: true,
            type: 'label',
            local: true,
        }
    },
    { 
        id: 'namespace',
        header: 'NAMESPACE',
        cellType: 'link',
        cellProps: {
            urlBuilder: (row: TableRow) => prefixRoute(`${ROUTES.Workloads}/namespaces/${row.namespace}`),
        },
        sortingConfig: {
            enabled: true,
            type: 'label',
            local: true,
        }
    },
    { 
        id: 'replicas',
        header: 'REPLICAS',
        cellType: 'custom',
        cellBuilder: (row: TableRow) => ReplicasCell(row.replicas),
        sortingConfig: {
            enabled: true,
            type: 'value',
            local: true,
        }
    }
]

class StatefulSetQueryBuilder implements QueryBuilder<TableRow> {
    rootQueryBuilder(variables: SceneVariableSet | SceneVariables, sorting: SortingState, sortingConfig?: ColumnSortingConfig<TableRow>) {
        return new SceneQueryRunner({
            datasource: {
                uid: '$datasource',
                type: 'prometheus',
            },
            queries: [
                {
                    refId: 'statefulsets',
                    expr: `
                        group(
                            ${Metrics.kubeStatefulSetCreated.name}{
                                cluster="$cluster",
                                ${Metrics.kubeStatefulSetCreated.labels.namespace}=~"$namespace",
                                ${Metrics.kubeStatefulSetCreated.labels.statefulset}=~".*$search.*"
                            }
                        ) by (
                            ${Metrics.kubeStatefulSetCreated.labels.statefulset},
                            ${Metrics.kubeStatefulSetCreated.labels.namespace}
                        )`,
                    instant: true,
                    format: 'table'
                },
            ], 
        })
    }
    rowQueryBuilder(rows: TableRow[], variables: SceneVariableSet | SceneVariables) {
        return createRowQueries(rows, variables);
    }
}

export const getStatefulSetsScene = () => {

    const queryBuilder = new StatefulSetQueryBuilder();

    const variables = new SceneVariableSet({
        variables: [
            namespaceVariable,
            searchVariable,
        ],
    });

    const defaultSorting: SortingState = {
        columnId: 'statefulset',
        direction: 'asc',
    }

    return new EmbeddedScene({
        $variables: variables,
        controls: [
            new VariableValueSelectors({})
        ],
        body: new SceneFlexLayout({
            children: [
                new SceneFlexItem({
                    width: '100%',
                    height: '100%',
                    body: new AsyncTable<TableRow>({
                        columns,
                        $data: queryBuilder.rootQueryBuilder(variables, defaultSorting),
                        asyncDataRowMapper,
                        createRowId: (row) => `${row.namespace}/${row.statefulset}`,
                        expandedRowBuilder: buildExpandedRowScene,
                        queryBuilder,
                    }),
                }),
            ],
        }),
    })
}
