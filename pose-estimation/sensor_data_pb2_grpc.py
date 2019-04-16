# Generated by the gRPC Python protocol compiler plugin. DO NOT EDIT!
import grpc

from google.protobuf import empty_pb2 as google_dot_protobuf_dot_empty__pb2
import sensor_data_pb2 as sensor__data__pb2


class SensorDataReceiverStub(object):
  # missing associated documentation comment in .proto file
  pass

  def __init__(self, channel):
    """Constructor.

    Args:
      channel: A grpc.Channel.
    """
    self.StreamWatchData = channel.stream_unary(
        '/posepair.SensorDataReceiver/StreamWatchData',
        request_serializer=sensor__data__pb2.WatchDataBlock.SerializeToString,
        response_deserializer=google_dot_protobuf_dot_empty__pb2.Empty.FromString,
        )
    self.StreamHumanPose = channel.stream_unary(
        '/posepair.SensorDataReceiver/StreamHumanPose',
        request_serializer=sensor__data__pb2.HumanPose.SerializeToString,
        response_deserializer=google_dot_protobuf_dot_empty__pb2.Empty.FromString,
        )


class SensorDataReceiverServicer(object):
  # missing associated documentation comment in .proto file
  pass

  def StreamWatchData(self, request_iterator, context):
    """StreamWatchData implements the smartwatch (client) side of the sensor data streaming
    """
    context.set_code(grpc.StatusCode.UNIMPLEMENTED)
    context.set_details('Method not implemented!')
    raise NotImplementedError('Method not implemented!')

  def StreamHumanPose(self, request_iterator, context):
    # missing associated documentation comment in .proto file
    pass
    context.set_code(grpc.StatusCode.UNIMPLEMENTED)
    context.set_details('Method not implemented!')
    raise NotImplementedError('Method not implemented!')


def add_SensorDataReceiverServicer_to_server(servicer, server):
  rpc_method_handlers = {
      'StreamWatchData': grpc.stream_unary_rpc_method_handler(
          servicer.StreamWatchData,
          request_deserializer=sensor__data__pb2.WatchDataBlock.FromString,
          response_serializer=google_dot_protobuf_dot_empty__pb2.Empty.SerializeToString,
      ),
      'StreamHumanPose': grpc.stream_unary_rpc_method_handler(
          servicer.StreamHumanPose,
          request_deserializer=sensor__data__pb2.HumanPose.FromString,
          response_serializer=google_dot_protobuf_dot_empty__pb2.Empty.SerializeToString,
      ),
  }
  generic_handler = grpc.method_handlers_generic_handler(
      'posepair.SensorDataReceiver', rpc_method_handlers)
  server.add_generic_rpc_handlers((generic_handler,))
