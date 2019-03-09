package posepair;

import static io.grpc.MethodDescriptor.generateFullMethodName;
import static io.grpc.stub.ClientCalls.asyncBidiStreamingCall;
import static io.grpc.stub.ClientCalls.asyncClientStreamingCall;
import static io.grpc.stub.ClientCalls.asyncServerStreamingCall;
import static io.grpc.stub.ClientCalls.asyncUnaryCall;
import static io.grpc.stub.ClientCalls.blockingServerStreamingCall;
import static io.grpc.stub.ClientCalls.blockingUnaryCall;
import static io.grpc.stub.ClientCalls.futureUnaryCall;
import static io.grpc.stub.ServerCalls.asyncBidiStreamingCall;
import static io.grpc.stub.ServerCalls.asyncClientStreamingCall;
import static io.grpc.stub.ServerCalls.asyncServerStreamingCall;
import static io.grpc.stub.ServerCalls.asyncUnaryCall;
import static io.grpc.stub.ServerCalls.asyncUnimplementedStreamingCall;
import static io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall;

/**
 */
@javax.annotation.Generated(
    value = "by gRPC proto compiler (version 1.19.0)",
    comments = "Source: watch_data.proto")
public final class WatchDataReceiverGrpc {

  private WatchDataReceiverGrpc() {}

  public static final String SERVICE_NAME = "posepair.WatchDataReceiver";

  // Static method descriptors that strictly reflect the proto.
  private static volatile io.grpc.MethodDescriptor<posepair.WatchData.WatchDataBlock,
      com.google.protobuf.Empty> getStreamWatchDataMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "StreamWatchData",
      requestType = posepair.WatchData.WatchDataBlock.class,
      responseType = com.google.protobuf.Empty.class,
      methodType = io.grpc.MethodDescriptor.MethodType.CLIENT_STREAMING)
  public static io.grpc.MethodDescriptor<posepair.WatchData.WatchDataBlock,
      com.google.protobuf.Empty> getStreamWatchDataMethod() {
    io.grpc.MethodDescriptor<posepair.WatchData.WatchDataBlock, com.google.protobuf.Empty> getStreamWatchDataMethod;
    if ((getStreamWatchDataMethod = WatchDataReceiverGrpc.getStreamWatchDataMethod) == null) {
      synchronized (WatchDataReceiverGrpc.class) {
        if ((getStreamWatchDataMethod = WatchDataReceiverGrpc.getStreamWatchDataMethod) == null) {
          WatchDataReceiverGrpc.getStreamWatchDataMethod = getStreamWatchDataMethod = 
              io.grpc.MethodDescriptor.<posepair.WatchData.WatchDataBlock, com.google.protobuf.Empty>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.CLIENT_STREAMING)
              .setFullMethodName(generateFullMethodName(
                  "posepair.WatchDataReceiver", "StreamWatchData"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  posepair.WatchData.WatchDataBlock.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.google.protobuf.Empty.getDefaultInstance()))
                  .setSchemaDescriptor(new WatchDataReceiverMethodDescriptorSupplier("StreamWatchData"))
                  .build();
          }
        }
     }
     return getStreamWatchDataMethod;
  }

  /**
   * Creates a new async stub that supports all call types for the service
   */
  public static WatchDataReceiverStub newStub(io.grpc.Channel channel) {
    return new WatchDataReceiverStub(channel);
  }

  /**
   * Creates a new blocking-style stub that supports unary and streaming output calls on the service
   */
  public static WatchDataReceiverBlockingStub newBlockingStub(
      io.grpc.Channel channel) {
    return new WatchDataReceiverBlockingStub(channel);
  }

  /**
   * Creates a new ListenableFuture-style stub that supports unary calls on the service
   */
  public static WatchDataReceiverFutureStub newFutureStub(
      io.grpc.Channel channel) {
    return new WatchDataReceiverFutureStub(channel);
  }

  /**
   */
  public static abstract class WatchDataReceiverImplBase implements io.grpc.BindableService {

    /**
     * <pre>
     * StreamWatchData implements the smartwatch (client) side of the sensor data streaming
     * </pre>
     */
    public io.grpc.stub.StreamObserver<posepair.WatchData.WatchDataBlock> streamWatchData(
        io.grpc.stub.StreamObserver<com.google.protobuf.Empty> responseObserver) {
      return asyncUnimplementedStreamingCall(getStreamWatchDataMethod(), responseObserver);
    }

    @java.lang.Override public final io.grpc.ServerServiceDefinition bindService() {
      return io.grpc.ServerServiceDefinition.builder(getServiceDescriptor())
          .addMethod(
            getStreamWatchDataMethod(),
            asyncClientStreamingCall(
              new MethodHandlers<
                posepair.WatchData.WatchDataBlock,
                com.google.protobuf.Empty>(
                  this, METHODID_STREAM_WATCH_DATA)))
          .build();
    }
  }

  /**
   */
  public static final class WatchDataReceiverStub extends io.grpc.stub.AbstractStub<WatchDataReceiverStub> {
    private WatchDataReceiverStub(io.grpc.Channel channel) {
      super(channel);
    }

    private WatchDataReceiverStub(io.grpc.Channel channel,
        io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected WatchDataReceiverStub build(io.grpc.Channel channel,
        io.grpc.CallOptions callOptions) {
      return new WatchDataReceiverStub(channel, callOptions);
    }

    /**
     * <pre>
     * StreamWatchData implements the smartwatch (client) side of the sensor data streaming
     * </pre>
     */
    public io.grpc.stub.StreamObserver<posepair.WatchData.WatchDataBlock> streamWatchData(
        io.grpc.stub.StreamObserver<com.google.protobuf.Empty> responseObserver) {
      return asyncClientStreamingCall(
          getChannel().newCall(getStreamWatchDataMethod(), getCallOptions()), responseObserver);
    }
  }

  /**
   */
  public static final class WatchDataReceiverBlockingStub extends io.grpc.stub.AbstractStub<WatchDataReceiverBlockingStub> {
    private WatchDataReceiverBlockingStub(io.grpc.Channel channel) {
      super(channel);
    }

    private WatchDataReceiverBlockingStub(io.grpc.Channel channel,
        io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected WatchDataReceiverBlockingStub build(io.grpc.Channel channel,
        io.grpc.CallOptions callOptions) {
      return new WatchDataReceiverBlockingStub(channel, callOptions);
    }
  }

  /**
   */
  public static final class WatchDataReceiverFutureStub extends io.grpc.stub.AbstractStub<WatchDataReceiverFutureStub> {
    private WatchDataReceiverFutureStub(io.grpc.Channel channel) {
      super(channel);
    }

    private WatchDataReceiverFutureStub(io.grpc.Channel channel,
        io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected WatchDataReceiverFutureStub build(io.grpc.Channel channel,
        io.grpc.CallOptions callOptions) {
      return new WatchDataReceiverFutureStub(channel, callOptions);
    }
  }

  private static final int METHODID_STREAM_WATCH_DATA = 0;

  private static final class MethodHandlers<Req, Resp> implements
      io.grpc.stub.ServerCalls.UnaryMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ServerStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ClientStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.BidiStreamingMethod<Req, Resp> {
    private final WatchDataReceiverImplBase serviceImpl;
    private final int methodId;

    MethodHandlers(WatchDataReceiverImplBase serviceImpl, int methodId) {
      this.serviceImpl = serviceImpl;
      this.methodId = methodId;
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public void invoke(Req request, io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        default:
          throw new AssertionError();
      }
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public io.grpc.stub.StreamObserver<Req> invoke(
        io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_STREAM_WATCH_DATA:
          return (io.grpc.stub.StreamObserver<Req>) serviceImpl.streamWatchData(
              (io.grpc.stub.StreamObserver<com.google.protobuf.Empty>) responseObserver);
        default:
          throw new AssertionError();
      }
    }
  }

  private static abstract class WatchDataReceiverBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoFileDescriptorSupplier, io.grpc.protobuf.ProtoServiceDescriptorSupplier {
    WatchDataReceiverBaseDescriptorSupplier() {}

    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return posepair.WatchData.getDescriptor();
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.ServiceDescriptor getServiceDescriptor() {
      return getFileDescriptor().findServiceByName("WatchDataReceiver");
    }
  }

  private static final class WatchDataReceiverFileDescriptorSupplier
      extends WatchDataReceiverBaseDescriptorSupplier {
    WatchDataReceiverFileDescriptorSupplier() {}
  }

  private static final class WatchDataReceiverMethodDescriptorSupplier
      extends WatchDataReceiverBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoMethodDescriptorSupplier {
    private final String methodName;

    WatchDataReceiverMethodDescriptorSupplier(String methodName) {
      this.methodName = methodName;
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.MethodDescriptor getMethodDescriptor() {
      return getServiceDescriptor().findMethodByName(methodName);
    }
  }

  private static volatile io.grpc.ServiceDescriptor serviceDescriptor;

  public static io.grpc.ServiceDescriptor getServiceDescriptor() {
    io.grpc.ServiceDescriptor result = serviceDescriptor;
    if (result == null) {
      synchronized (WatchDataReceiverGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new WatchDataReceiverFileDescriptorSupplier())
              .addMethod(getStreamWatchDataMethod())
              .build();
        }
      }
    }
    return result;
  }
}
