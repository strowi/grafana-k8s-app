import { DataSourceVariable, QueryVariable, SceneTimeRange, SceneVariableSet, SceneVariables, sceneGraph } from "@grafana/scenes";
import { JsonData } from "components/AppConfig";
import { Metrics } from "metrics/metrics";

export function resolveVariable(sceneVariables: SceneVariables, name: string) {

    const variable = sceneVariables.getByName(name);

    if (!variable) {
        if (sceneVariables.parent) {
            const parentVar = sceneGraph.lookupVariable(name, sceneVariables.parent);
            if (parentVar) {
                return parentVar.getValue();
            }
        }
        throw new Error(`Variable ${name} not found`);
    }

    return variable.getValue();
}

export interface TopLevelVariableSettings {
    datasource: string;
    defaultDatasource: string;
    defaultCluster?: string;
    clusterFilter?: string;
}

export function createTopLevelVariables(props: JsonData) {

    const settings: TopLevelVariableSettings = {
        datasource: props.datasource || 'prometheus',
        defaultDatasource: props.defaultDatasource || 'prometheus',
        defaultCluster: props.defaultCluster,
        clusterFilter: props.clusterFilter,
    }

    return new SceneVariableSet({
        variables: [
            new DataSourceVariable({
                name: 'datasource',
                label: 'Datasource',
                pluginId: 'prometheus',
                regex: settings.datasource,
                value: settings.defaultDatasource,
            }),
            createClusterVariable(settings.defaultCluster, settings.clusterFilter),
        ],
    })
}

export function createClusterVariable(defaultCluster?: string, clusterFilter?: string) {
    return new QueryVariable({
        name: 'cluster',
        label: 'Cluster',
        datasource: {
            uid: '$datasource',
            type: 'prometheus',
        },
        query: {
          refId: 'cluster',
          query: clusterFilter ? `label_values(${clusterFilter}, cluster)` : 'label_values(kube_namespace_status_phase, cluster)',
        },
        value: defaultCluster,
    })
}

export function createNamespaceVariable() {
    return new QueryVariable({
        name: 'namespace',
        label: 'Namespace',
        datasource: {
            uid: '$datasource',
            type: 'prometheus',
        },
        query: {
            refId: 'namespace',
            query: `label_values(${Metrics.kubeNamespaceStatusPhase.name}{cluster="$cluster"},${Metrics.kubeNamespaceStatusPhase.labels.namespace})`,
        },
        defaultToAll: true,
        allValue: '.*',
        includeAll: true,
        isMulti: true,
    })
}

export function createTimeRange() {
    return new SceneTimeRange({
        from: 'now-1h',
        to: 'now',
    });
}
