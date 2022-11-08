/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component } from "react";
import _ from "lodash";
import { RouteComponentProps } from "react-router-dom";
import { ContentPanel } from "../../../../components/ContentPanel";
import IndexService from "../../../../services/IndexService";
import RollupService from "../../../../services/RollupService";
import { BREADCRUMBS } from "../../../../utils/constants";
import { getErrorMessage } from "../../../../utils/helpers";
import { CoreServicesContext } from "../../../../components/core_services";
import { EuiComboBox, EuiFlexGroup, EuiFlexItem, EuiSearchBar, Query } from "@elastic/eui";
import { FieldItem } from "../../../../../models/interfaces";
import IndexPreview from "../../components/IndexPreview";
import { parseFieldOptions, compareFieldItem } from "../../utils/helpers";

interface IndicesProps extends RouteComponentProps {
  indexService: IndexService;
  rollupService: RollupService;
}

interface IndicesState {
  isLoading?: boolean;
  indices?: { label: string; value: string }[];
  sourceIndex?: { label: string; value: string }[];
  columns: any[];
  raw_data: any[];

  mappings: any[];
  fields: any[];
  allMappings: any[];
}

const returnLimit = 500;

export default class Indices extends Component<IndicesProps, IndicesState> {
  static contextType = CoreServicesContext;
  constructor(props: IndicesProps) {
    super(props);

    this.state = {
      isLoading: false,
      indices: [],
      columns: [],
      raw_data: [],

      mappings: [],
      fields: [],
      allMappings: [],

      query: Query.parse(""),
    };

    this.getIndices = _.debounce(this.getIndices, 500, { leading: true });
  }

  async componentDidMount() {
    this.context.chrome.setBreadcrumbs([BREADCRUMBS.INDEX_MANAGEMENT, BREADCRUMBS.INDICES]);
    await this.getIndices();
  }

  getIndices = async (): Promise<void> => {
    this.setState({ isLoading: true });
    try {
      const { indexService } = this.props;

      const getIndicesResponse = await indexService.getIndices({
        from: 0,
        size: 50,
        search: "",
        sortField: "index",
        sortDirection: "desc",
        showDataStreams: false,
      });

      if (getIndicesResponse.ok) {
        const { indices } = getIndicesResponse.response;
        this.setState({
          isLoading: false,
          indices: indices.map((i) => ({ label: i.index, value: i.index })),
        });
      } else {
        this.context.notifications.toasts.addDanger(getIndicesResponse.error);
      }
    } catch (err) {
      this.context.notifications.toasts.addDanger(getErrorMessage(err, "There was a problem loading the indices"));
    }
  };

  mapDataToTable = (data: unknown[], columns: any[]) => {
    const raw_data = [];

    if (!data || data.length == 0) {
      return raw_data;
    }

    for (let i = 0; i < data.length; i++) {
      let row = {};
      columns.forEach((column) => {
        row = { ...row, [column.id]: data[i][column.id] };
      });
      raw_data.push(row);
    }
    return raw_data;
  };

  onIndexChange = async (value) => {
    const srcIndex = value[0].value;

    if (!srcIndex.length) return;
    try {
      const { rollupService, indexService } = this.props;
      const response = await rollupService.getMappings(srcIndex);
      if (response.ok) {
        let allMappings: FieldItem[][] = [];
        const mappings = response.response;
        //Push mappings array to allMappings 2D array first
        for (let index in mappings) {
          allMappings.push(parseFieldOptions("", mappings[index].mappings.properties));
        }
        //Find intersect from all mappings
        const fields = allMappings.reduce((mappingA, mappingB) =>
          mappingA.filter((itemA) => mappingB.some((itemB) => compareFieldItem(itemA, itemB)))
        );

        const columns = fields.map((field) => ({
          id: field.label,
        }));

        const searchIndexResponse = await indexService.searchIndexData(
          srcIndex,
          {
            from: 0,
            size: returnLimit,
          },
          {}
        );

        const raw_data = this.mapDataToTable(searchIndexResponse.response.results, columns);

        this.setState({ columns, raw_data, sourceIndex: value });
      } else {
        this.context.notifications.toasts.addDanger(`Could not load fields: ${response.error}`);
      }
    } catch (err) {
      this.context.notifications.toasts.addDanger(getErrorMessage(err, "Could not load fields"));
    }
  };

  onSearchChange = async ({ query, error }): void => {
    if (error) {
      return;
    }

    const q = EuiSearchBar.Query.toESQuery(query);

    const { indexService } = this.props;
    const { sourceIndex, columns } = this.state;

    if (sourceIndex && query) {
      const searchIndexResponse = await indexService.searchIndexData(
        sourceIndex[0].value,
        {
          from: 0,
          size: returnLimit,
        },
        {
          query: q,
        }
      );

      const raw_data = this.mapDataToTable(searchIndexResponse.response.results, columns);
      this.setState({ raw_data });
    }
  };

  render() {
    const { isLoading, indices, columns, raw_data, sourceIndex } = this.state;

    let fields = {};

    columns.forEach((column) => {
      fields = { ...fields, [column.id]: { type: "string" } };
    });

    const schema = {
      strict: true,
      fields,
    };

    return (
      <div>
        <ContentPanel bodyStyles={{ padding: "initial" }} title="Preview Indices">
          <EuiFlexGroup style={{ padding: "0px 5px" }} direction="column">
            <EuiFlexItem>
              <EuiComboBox
                placeholder="Select source index"
                options={indices}
                onChange={this.onIndexChange}
                singleSelection={{ asPlainText: true }}
                selectedOptions={sourceIndex}
                isLoading={isLoading}
              />
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiSearchBar box={{ placeholder: "Search", schema, incremental: true }} onChange={this.onSearchChange} />
            </EuiFlexItem>
            <EuiFlexItem>{raw_data && raw_data.length > 0 ? <IndexPreview columns={columns} raw_data={raw_data} /> : ""}</EuiFlexItem>
          </EuiFlexGroup>
        </ContentPanel>
      </div>
    );
  }
}
