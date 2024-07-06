import { EmbeddedScene, PanelBuilders, SceneAppPage, SceneAppPageLike, SceneControlsSpacer, SceneFlexItem, SceneFlexLayout, SceneQueryRunner, SceneRefreshPicker, SceneRouteMatch, SceneTimePicker, VariableValueSelectors } from "@grafana/scenes";
import { ROUTES } from "../../../constants";
import { prefixRoute } from "utils/utils.routing";
import { usePluginProps } from "utils/utils.plugin";
import { createTopLevelVariables, createTimeRange } from "../../../common/variableHelpers";
import { createResourceLabels } from "../components/ResourceLabels";
import { getPodsScene } from "../tabs/Pods/Pods";
import { LabelFilters } from "../../../common/queryHelpers";
import { Metrics } from "metrics/metrics";
import Heading from "components/Heading";
import { CPUUsagePanel } from "../components/CPUUsagePanel";
import { MemoryUsagePanel } from "../components/MemoryUsagePanel";
import { AlertsTable } from "components/AlertsTable";

function getPods(deployment: string, namespace: string) {
    const staticLabelFilters: LabelFilters = [
        {
            label: 'created_by_name',
            op: '=~',
            value: `${deployment}.*`
        },
        {
            label: 'created_by_kind',
            op: '=',
            value: 'ReplicaSet' 
        },
        {
            label: 'namespace',
            op: '=',
            value: namespace
        }
    ]

    return getPodsScene(staticLabelFilters, false, false)
}

function getReplicasPanel(deployment: string, namespace: string) {
    return PanelBuilders.timeseries()
        .setTitle('Replicas')
        .setData(new SceneQueryRunner({
            datasource: {
                uid: '$datasource',
                type: 'prometheus',
            },
            queries: [
                {
                    refId: 'unavailable_replicas',
                    expr: `
                        max(
                            ${Metrics.kubeDeploymentStatusReplicasUnavailable.name}{
                                ${Metrics.kubeDeploymentStatusReplicasUnavailable.labels.deployment}=~"${deployment}",
                                ${Metrics.kubeDeploymentStatusReplicasUnavailable.labels.namespace}="${namespace}",
                                cluster="$cluster"
                            }
                        ) by (${Metrics.kubeDeploymentStatusReplicasUnavailable.labels.deployment})`,
                    legendFormat: 'Unavailable'
                },
                {
                    refId: 'available_replicas',
                    expr: `
                        max(
                            ${Metrics.kubeDeploymentStatusReplicasAvailable.name}{
                                ${Metrics.kubeDeploymentStatusReplicasAvailable.labels.deployment}=~"${deployment}",
                                ${Metrics.kubeDeploymentStatusReplicasAvailable.labels.namespace}="${namespace}",
                                cluster="$cluster"
                            }
                        ) by (${Metrics.kubeDeploymentStatusReplicasAvailable.labels.deployment})`,
                    legendFormat: 'Available'
                },
                {
                    refId: 'replicas',
                    expr: `
                        max(
                            ${Metrics.kubeDeploymentStatusReplicas.name}{
                                ${Metrics.kubeDeploymentStatusReplicas.labels.deployment}=~"${deployment}",
                                ${Metrics.kubeDeploymentStatusReplicas.labels.namespace}="${namespace}",
                                cluster="$cluster"
                            }
                        ) by (${Metrics.kubeDeploymentStatusReplicas.labels.deployment})`,
                    legendFormat: 'Replicas'
                },
            ]
        }))
        .setOverrides((builder) => {
            builder.matchFieldsByQuery('replicas')
                .overrideCustomFieldConfig('fillOpacity', 10)
            builder.matchFieldsByQuery('available_replicas')
                .overrideCustomFieldConfig('fillOpacity', 10)
        })
        .build()
}

function getScene(deployment: string, namespace = '$namespace') {
    return new EmbeddedScene({
        controls: [
            new VariableValueSelectors({}),
            new SceneControlsSpacer(),
            new SceneTimePicker({ isOnCanvas: true }),
            new SceneRefreshPicker({
                intervals: ['5s', '1m', '1h'],
                isOnCanvas: true,
            }),
        ],
        body: new SceneFlexLayout({
            direction: 'column',
            children: [
                new SceneFlexLayout({
                    direction: 'row',
                    minHeight: 200,
                    children: [
                        new SceneFlexItem({
                            height: 'auto',
                            width: `${(1/3) * 100}%`,
                            body: createResourceLabels('deployment', [{
                                label: 'deployment',
                                op: '=',
                                value: deployment,
                            }, {
                                label: 'namespace',
                                op: '=',
                                value: namespace,
                            }]),
                        }),
                        new SceneFlexItem({
                            width: `${(2/3) * 100}%`,
                            body: AlertsTable([
                                {
                                    label: 'deployment',
                                    op: '=',
                                    value: deployment,
                                }
                            ], false, false)
                        }),
                    ]
                }),
                new SceneFlexLayout({
                    direction: 'row',
                    children: [
                        new SceneFlexItem({
                            height: 200,
                            body: getReplicasPanel(deployment, namespace),
                        })
                    ]
                }),
                new SceneFlexLayout({
                    direction: 'row',
                    children: [
                        new Heading({ title: 'Resource Usage Overview'})
                    ]
                }),
                new SceneFlexLayout({
                    direction: 'row',
                    minHeight: 400,
                    children: [
                        CPUUsagePanel([{
                            label: 'pod',
                            op: '=~',
                            value: `${deployment}.*`
                        }, {
                            label: 'namespace',
                            op: '=',
                            value: namespace
                        }]),
                        MemoryUsagePanel([{
                            label: 'pod',
                            op: '=~',
                            value: `${deployment}.*`
                        }, {
                            label: 'namespace',
                            op: '=',
                            value: namespace
                        }]),
                    ]
                }),
                new SceneFlexLayout({
                    direction: 'row',
                    children: [
                        new Heading({ title: 'Pods'})
                    ]
                }),
                new SceneFlexLayout({
                    direction: 'row',
                    children: [
                        new SceneFlexItem({
                            width: '100%',
                            body: getPods(deployment, namespace),
                        }),
                    ]
                }),
            ]
        }),
    })
}

export function DeploymentPage(routeMatch: SceneRouteMatch<any>, parent: SceneAppPageLike) {

    const props = usePluginProps();

    const variables = createTopLevelVariables({
        datasource: props?.meta.jsonData?.datasource || 'prometheus'
    })

    const timeRange = createTimeRange()

    return new SceneAppPage({
        title: `Deployment - ${routeMatch.params.namespace}/${routeMatch.params.name}`,
        titleIcon: 'dashboard',
        $variables: variables,
        $timeRange: timeRange,
        url: prefixRoute(`${ROUTES.Workloads}/deployments/${routeMatch.params.namespace}/${routeMatch.params.name}`),
        getScene: () => getScene(routeMatch.params.name, routeMatch.params.namespace),
        getParentPage: () => parent,
    })
}
