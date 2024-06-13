import { 
    EmbeddedScene,
    SceneFlexLayout, 
    SceneFlexItem,
    TextBoxVariable,
    VariableValueSelectors,
    SceneVariableSet,
} from '@grafana/scenes';
import { ReplicasCell } from 'pages/Workloads/components/ReplicasCell';
import { getSeriesValue } from 'common/seriesHelpers';
import { buildExpandedRowScene } from './DeploymentExpandedRow';
import { createNamespaceVariable } from 'common/variableHelpers';
import { TableRow } from './types';
import { AsyncTable, Column } from 'components/AsyncTable';
import { SortingState } from 'common/sortingHelpers';
import { prefixRoute } from 'utils/utils.routing';
import { ROUTES } from '../../../../constants';
import { DeploymentQueryBuilder } from './Queries';

const namespaceVariable = createNamespaceVariable();

const searchVariable = new TextBoxVariable({
    name: 'search',
    label: 'Search',
    value: '',
});

const columns: Array<Column<TableRow>> = [
    {
        id: 'deployment',
        header: 'DEPLOYMENT',
        cellType: 'link',
        cellProps: {
            urlBuilder: (row: TableRow) => prefixRoute(`${ROUTES.Workloads}/deployments/${row.namespace}/${row.deployment}`),
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

const serieMatcherPredicate = (row: TableRow) => (value: any) => value.deployment === row.deployment && value.namespace === row.namespace;

function asyncRowMapper(row: TableRow, asyncRowData: any) {
    
    row.deployment = row.owner_name

    const total = getSeriesValue(asyncRowData, 'replicas', serieMatcherPredicate(row))
    const ready = getSeriesValue(asyncRowData, 'replicas_ready', serieMatcherPredicate(row))

    row.replicas = {
        total,
        ready
    }
}

function createRowId(row: TableRow) {
    return `${row.namespace}/${row.deployment}`
}

export const getDeploymentsScene = () => {

    const queryBuilder = new DeploymentQueryBuilder()

    const variables = new SceneVariableSet({
        variables: [
            namespaceVariable,
            searchVariable,
        ],
    })

    const defaultSorting: SortingState = {
        columnId: 'deployment',
        direction: 'asc',
    }

    return new EmbeddedScene({
        $variables: variables,
        controls: [
            new VariableValueSelectors({}),
        ],
        body: new SceneFlexLayout({
            children: [
                new SceneFlexItem({
                    width: '100%',
                    height: '100%',
                    body: new AsyncTable<TableRow>({
                        columns: columns,
                        $data: queryBuilder.rootQueryBuilder(variables, defaultSorting, undefined),
                        createRowId: createRowId,
                        asyncDataRowMapper: asyncRowMapper,
                        queryBuilder: queryBuilder,
                        expandedRowBuilder: buildExpandedRowScene,
                    }),
                }),
            ],
        }),
    })
}
