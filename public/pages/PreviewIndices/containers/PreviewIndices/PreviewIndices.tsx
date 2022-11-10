/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component } from "react";
import { RouteComponentProps } from "react-router-dom";
import { ContentPanel } from "../../../../components/ContentPanel";
import IndexService from "../../../../services/IndexService";
import RollupService from "../../../../services/RollupService";
import { BREADCRUMBS } from "../../../../utils/constants";
import { getErrorMessage } from "../../../../utils/helpers";
import { CoreServicesContext } from "../../../../components/core_services";
import { EuiComboBox, EuiComboBoxOptionOption, EuiFlexGroup, EuiFlexItem, EuiSearchBar, Query } from "@elastic/eui";
import { FieldItem } from "../../../../../models/interfaces";
import { OnSearchChangeArgs } from "../../../../../public/models/interfaces";
import IndexPreview from "../../components/IndexPreview";
import { parseFieldOptions, compareFieldItem } from "../../utils/helpers";

interface IndicesProps extends RouteComponentProps {
  indexService: IndexService;
  rollupService: RollupService;
}

interface ColumnInfo {
  id: string;
  type: string;
}

interface IndicesState {
  indices?: { label: string; value: string }[];
  sourceIndex?: EuiComboBoxOptionOption<string>[];
  columns: ColumnInfo[];
  raw_data?: unknown[];
  query?: Query;
}

const returnLimit = 1000;

export default class Indices extends Component<IndicesProps, IndicesState> {
  static contextType = CoreServicesContext;
  constructor(props: IndicesProps) {
    super(props);

    this.state = {
      indices: [],
      columns: [],
      raw_data: [],
      query: Query.parse(""),
    };
  }

  async componentDidMount() {
    console.log("componentDidMount");
    this.context.chrome.setBreadcrumbs([BREADCRUMBS.INDEX_MANAGEMENT, BREADCRUMBS.INDICES]);
    await this.getIndices();
  }

  getIndices = async (): Promise<void> => {
    console.log("getIndices");
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
          indices: indices.map((i) => ({ label: i.index, value: i.index })),
        });
      } else {
        this.context.notifications.toasts.addDanger(getIndicesResponse.error);
      }
    } catch (err) {
      this.context.notifications.toasts.addDanger(getErrorMessage(err, "There was a problem loading the indices"));
    }
  };

  mapDataToTable = (data: { [key: string]: unknown }[], columns: ColumnInfo[]) => {
    console.log("mapDataToTable");
    const raw_data: Array<unknown> = [];

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

  parseColumns = (mappings: any): ColumnInfo[] => {
    console.log("parseColumns");
    let allMappings: FieldItem[][] = [];
    //Push mappings array to allMappings 2D array first
    for (let index in mappings) {
      allMappings.push(parseFieldOptions("", mappings[index].mappings.properties));
    }
    //Find intersect from all mappings
    const fields = allMappings.reduce((mappingA, mappingB) =>
      mappingA.filter((itemA) => mappingB.some((itemB) => compareFieldItem(itemA, itemB)))
    );

    const columns = fields
      .filter((f) => f.type === "keyword")
      .map((field) => {
        return {
          id: field.label,
          type: "string",
        };
      });

    return columns;
  };

  getData = async (srcIndex: string, columns: ColumnInfo[], query?: object) => {
    console.log("getData");
    const { indexService } = this.props;

    try {
      const searchIndexResponse = await indexService.searchIndexData(
        srcIndex,
        {
          from: 0,
          size: returnLimit,
        },
        query ? { query } : {}
      );

      if (searchIndexResponse.ok) {
        return this.mapDataToTable(searchIndexResponse.response.results, columns);
      } else {
        this.context.notifications.toasts.addDanger(searchIndexResponse.error);
      }
    } catch (err) {
      this.context.notifications.toasts.addDanger(getErrorMessage(err, "There was a problem loading data"));
    }
  };

  getColumns = async (srcIndex: string): Promise<ColumnInfo[]> => {
    console.log("getColumns");
    try {
      const { rollupService } = this.props;

      const response = await rollupService.getMappings(srcIndex);
      if (response.ok) {
        const columns = this.parseColumns(response.response);

        return columns;
      } else {
        this.context.notifications.toasts.addDanger(`Could not load fields: ${response.error}`);
      }
    } catch (err) {
      this.context.notifications.toasts.addDanger(getErrorMessage(err, "Could not load fields"));
    }

    return [];
  };

  onIndexChange = async (value: Array<EuiComboBoxOptionOption<string>>) => {
    console.log("onIndexChange");
    if (value.length === 0) {
      return;
    }

    const srcIndex = value[0].value;

    if (!srcIndex) {
      return;
    }

    const columns = await this.getColumns(srcIndex);
    const raw_data = await this.getData(srcIndex, columns);

    this.setState({ columns, raw_data, sourceIndex: value });
  };

  onSearchChange = async ({ query, error }: OnSearchChangeArgs): Promise<void> => {
    console.log("onSearchChange");
    if (error) {
      return;
    }

    const q = EuiSearchBar.Query.toESQuery(query);

    const { sourceIndex, columns } = this.state;

    if (sourceIndex && sourceIndex.length > 0 && sourceIndex[0].value && columns) {
      const raw_data = await this.getData(sourceIndex[0].value, columns, q);

      this.setState({ raw_data });
    }
  };

  render() {
    const { indices, columns, raw_data, sourceIndex } = this.state;

    let fields = {};

    columns?.forEach((column) => {
      fields = { ...fields, [column.id]: { type: column.type } };
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
