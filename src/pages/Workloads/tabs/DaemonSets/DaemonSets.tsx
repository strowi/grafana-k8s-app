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
import { prefixRoute } from 'utils/utils.routing';
import { ROUTES } from '../../../../constants';
import { TableRow } from "./types";

const namespaceVariable = createNamespaceVariable();

const searchVariable = new TextBoxVariable({
    name: 'search',
    label: 'Search',
    value: '',
});

const serieMatcherPredicate = (row: TableRow) => (value: any) => value.daemonset === row.daemonset;

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
        id: 'daemonset',
        header: 'DAEMONSET',
        cellType: 'link',
        cellProps: {
            urlBuilder: (row: TableRow) => prefixRoute(`${ROUTES.Workloads}/daemonsets/${row.namespace}/${row.daemonset}`),
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

class DaemonSetsQueryBuilder implements QueryBuilder<TableRow> {
    rootQueryBuilder(variables: SceneVariableSet | SceneVariables, sorting: SortingState, sortingConfig?: ColumnSortingConfig<TableRow>) {
        return new SceneQueryRunner({
            datasource: {
                uid: '$datasource',
                type: 'prometheus',
            },
            queries: [
                {
                    refId: 'daemonsets',
                    expr: `
                        group(
                            ${Metrics.kubeDaemonSetCreated.name}{
                                ${Metrics.kubeDaemonSetCreated.labels.namespace}=~"$namespace",
                                ${Metrics.kubeDaemonSetCreated.labels.daemonset}=~".*$search.*",
                                cluster="$cluster",
                            }
                        ) by (
                            ${Metrics.kubeDaemonSetCreated.labels.daemonset},
                            ${Metrics.kubeDaemonSetCreated.labels.namespace}
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

export const getDaemonSetsScene = () => {

    const queryBuilder= new DaemonSetsQueryBuilder();

    const variables = new SceneVariableSet({
        variables: [
            namespaceVariable,
            searchVariable,
        ]
    })

    const deaultSorting: SortingState = {
        columnId: 'daemonset',
        direction: 'asc'
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
                        $data: queryBuilder.rootQueryBuilder(variables, deaultSorting),
                        queryBuilder,
                        asyncDataRowMapper,
                        createRowId: (row: TableRow) => `${row.namespace}/${row.daemonset}`,
                        expandedRowBuilder: buildExpandedRowScene,
                    }),
                }),
            ],
        }),
    })
}
